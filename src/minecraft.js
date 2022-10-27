const {ping} = require('minecraft-server-ping')
const { EC2: EC2Client } = require("@aws-sdk/client-ec2");
const EC2 = require("@aws-sdk/client-ec2");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const {NodeSSH} = require('node-ssh')
const fs = require('fs');

const client = new EC2Client({region: process.env.AWS_REGION || "ap-northeast-1"})
const minutes = 60 * 1000;
const ssh = new NodeSSH()

class MinecraftServer {
    constructor(client) {
        this.client = client;
        this.lastActivityTime = new Date();
        this.pendingShutdown = false;
    }

    async getServerPing() {
        try {
            const data = await ping(process.env.SERVER_HOST);
            return data;
        } catch {
            return null;
        }
    }

    async getNumPlayersOnline () {
        const data = await this.getServerPing();
        return data && data.players ? data.players.online : "--";
    }

    async getOnlinePlayersSample() {
        const data = await this.getServerPing();
        try {
            return data.players.sample.map(p => p.name)
        } catch {
            return [];
        }
    }

    async getServerOnline() {
        const data = await this.getServerPing();
        return data ? true : false;
    }

    async getInstanceStatus() {
        console.log(`Getting EC2 instance ${process.env.MC_SERVER_INSTANCE_ID} status.`);
        let command = new EC2.DescribeInstanceStatusCommand({InstanceIds: [process.env.MC_SERVER_INSTANCE_ID]});
        let data = await client.send(command);
        try {
            let instanceState = data.InstanceStatuses[0].InstanceState.Name;
            return instanceState;
        } catch {
            return 'stopped'
        }
    }

    async startInstance() {
        console.log(`Starting instance ${process.env.MC_SERVER_INSTANCE_ID}.`);
        let command = new EC2.StartInstancesCommand({InstanceIds: [process.env.MC_SERVER_INSTANCE_ID]});
        let data = await client.send(command);
    }

    async stopInstance() {
        console.log(`Shutting down instance ${process.env.MC_SERVER_INSTANCE_ID}.`);
        let command = new EC2.StopInstancesCommand({InstanceIds: [process.env.MC_SERVER_INSTANCE_ID]});
        let data = await client.send(command);
    }

    async startSnapshot() {
        console.log(`Starting backup of instance ${process.env.MC_SERVER_INSTANCE_ID}.`);
        let volumeId = await this.getInstanceVolumeId();
        let now = new Date();
        let command = new EC2.CreateSnapshotCommand({VolumeId: volumeId, Description: `mc-backup-${now.getFullYear()}-${now.getMonth()}-${now.getDay()}T${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}}`});
        let data = await client.send(command);
    }

    async getInstanceVolumeId() {
        let command = new EC2.DescribeVolumesCommand({Filters: [
            {
                Name: "attachment.instance-id",
                Values: [
                    process.env.MC_SERVER_INSTANCE_ID
                ]
            }
        ]});
        let data = await client.send(command);
        let volumeId = data.Volumes[0].VolumeId;
        return volumeId;
    }

    async getServerHost() {
        return process.env.SERVER_HOST;
    }

    setLastActivity() {
        this.lastActivityTime = new Date();
        console.log(`Setting last activity time to ${this.lastActivityTime.toISOString()}.`)
    }

    async shouldShutdown() {
        const running = await this.isRunning();
        const timeOut = (new Date() - this.lastActivityTime) > (this.getShutdownAfterMinutes() * minutes);
        return running && timeOut && this.pendingShutdown;
    }

    async shouldScheduleShutdown() {
        const running = await this.isRunning();
        const timeOut = (new Date() - this.lastActivityTime) > (this.getNotifyShutdownAfterMinutes() * minutes);
        return running && timeOut && !this.pendingShutdown;
    }

    async isRunning() {
        const status = await this.getInstanceStatus();
        const running = status === 'running';
        const online = await this.getServerOnline();
        return running && online;
    }

    getShutdownAfterMinutes() {
        return parseInt(process.env.SHUTDOWN_AFTER);
    }

    getNotifyShutdownAfterMinutes() {
        return parseInt(process.env.NOTIFY_SHUTDOWN_AFTER);
    }

    getChannels() {
        const channels = this.client.channels.cache.filter(channel => channel.name === process.env.CHANNEL_NAME)
        return channels;
    }

    async sendCommand(command) {
        const host = await this.getServerHost();
        console.log(`Connecting via SSH to server ${host}.`)
        const key = process.env.SERVER_SSH_PRIVATE_KEY.replace(/\\n/g, '\n')
        ssh.connect({
            host: host,
            username: process.env.SERVER_SSH_USER,
            privateKey: key
        }).then(() => {
            ssh.execCommand(`echo "${command}" > /run/minecraft.stdin`).then((stdout) => {
                ssh.dispose()
            })
        }).catch((e) => {
            console.error(`Failed to send message: ${e}.`)
        })
    }

    async sendSaveCommand() {
        await this.sendCommand("/save-all")
    }

    async sendSayCommand(message) {
        await this.sendCommand(`/say ${message}`)
    }

    async arePlayersOnline() {
        if(await this.isRunning()) {
            return await this.getNumPlayersOnline() !== 0;
        } else {
            return false;
        }
    }

    async notifyShutdown() {
        const channels = this.getChannels(this.client);
        channels.forEach((channel) => {
            console.log(`Sending message to channel ${channel}`)
            channel.send(
                {content: `Shutting down the server due to inactivity...`}
            );
        })
    }

    async scheduleShutdown() {
        this.pendingShutdown = true;
        console.log(`Sending shutdown notification.`);
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("mc-cancel-shutdown")
                    .setLabel("Wait, I'm still playing!")
                    .setStyle(ButtonStyle.Success)
            );
        const channels = this.getChannels(this.client);
        channels.forEach(async (channel) => {
            console.log(`Sending message to channel ${channel}`)
            const message_content =  `It looks like no one has been online in a while. Shutting down the server soon...`;
            let message = await channel.send(
                {content: message_content, components: [actionRow]}
            );
            const callback = async () => {
                message.edit({content: message_content, components: []});
                if(await this.shouldShutdown()) {
                    this.beginShutdown();
                }
            }
            setTimeout(callback.bind(this), this.getShutdownAfterMinutes() * minutes);
        });
    }

    async beginShutdown() {
        console.log(`Beginning shutdown.`);
        try {
            await this.sendSayCommand(`NOTICE: The server is beginning shutdown.`);
        } catch {
            console.error(`Failed to send say message to server.`);
        }
        this.pendingShutdown = false;
        await this.notifyShutdown();
        this.stopInstance();
        console.log(`Shutdown successfully started.`)
    }

    cancelShutdown() {
        console.log(`Cancelling shutdown.`);
        this.pendingShutdown = false;
        this.setLastActivity();
    }

    async updateShutdownSchedule() {
        console.log(`Beginning sequence: UPDATE_SHUTDOWN_SCHEDULE.`)
        const status = await this.getInstanceStatus();
        console.log(`Server's status is "${status}".`)
        if (status === "running") {
            if(await this.arePlayersOnline()) {
                console.log(`Players are currently online; Cancelling shutdown.`);
                this.cancelShutdown();
            } else {
                console.log(`No players currently online.`)
            }

            if(await this.shouldScheduleShutdown()) {
                console.log(`Server is inactive; Scheduling shutdown.`);
                this.scheduleShutdown();
            } else {
                console.log(``)
            }
        } else {
            console.log(`Server isn't running. Done!`)
        }
    }

    async updateStatus() {
        console.log(`Beginning bot status update.`)
        const status = await this.getInstanceStatus();
        const online = await this.getNumPlayersOnline();

        if (status === "running" && online !== "--") {
            console.log(`Updating bot's status to online.`)
            this.client.user.setPresence({ activities: [{ name: `Minecraft (${online} online)`}], status: 'online', afk: false });
            if(online !== 0) {
                this.setLastActivity()
            }
        } else if (status === "running" && online === "--") {
            console.log(`Updating bot's status to idle.`)
            this.client.user.setPresence({ activities: [{ name: 'Minecraft (Starting)'}], status: 'idle' , afk: true});
        } else {
            console.log(`Updating bot's status to dnd.`)
            this.client.user.setPresence({ activities: [{ name: 'Minecraft (Offline)'}], status: 'dnd' , afk: true});
        }
    }
}

module.exports = {MinecraftServer};
