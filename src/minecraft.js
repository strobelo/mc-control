const {ping} = require('minecraft-server-ping')
const { EC2: EC2Client } = require("@aws-sdk/client-ec2");
const EC2 = require("@aws-sdk/client-ec2");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const client = new EC2Client({region: process.env.AWS_REGION || "ap-northeast-1"})
const minutes = 60 * 1000;

class MinecraftServer {
    constructor(client) {
        this.client = client;
        this.shutdown_next_time = false;
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

    cancelNextShutdown() {
        this.shutdown_next_time = false;
    }

    scheduleNextShutdown() {
        this.shutdown_next_time = true;
    }

    shouldShutDown() {
        return this.shutdown_next_time
    }

    getChannels() {
        // const channel = this.client.channels.cache.get(process.env.CHANNEL_ID);
        // const channels = this.client.channels.cache.getAll("name", process.env.CHANNEL_NAME)
        const channels = this.client.channels.cache.filter(channel => channel.name === process.env.CHANNEL_NAME)
        return channels;
    }

    async updateShutdownSchedule() {
        console.log(`Beginning sequence: UPDATE_SHUTDOWN_SCHEDULE.`)
        const status = await this.getInstanceStatus();
        console.log(`Server's status is "${status}".`)
        if (status === "running") {
            console.log(`Server is running.`)
            if (this.shouldShutDown()) {
                console.log(`Shutdown already scheduled. Done!`)
            } else {
                console.log(`Shutdown not yet scheduled. Checking server activity...`)
                const online = await this.getNumPlayersOnline();
                if (online === 0) {
                    console.log(`No players online. starting shutdown sequence...`)
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
                        setTimeout(() => {
                            message.edit({content: message_content, components: []})
                        },  5 * minutes)
                    })
                    console.log(`Scheduling shutdown for next sequence.`)
                    this.scheduleNextShutdown();
                } else {
                    console.log(`There are players online. Not scheduling shutdown. Done!`)
                }
            }
        } else {
            console.log(`Server isn't running. Done!`)
        }
    }

    async checkShutdownSchedule() {
        console.log(`Beginning sequence: CHECK_SHUTDOWN_SCHEDULE.`)
        const status = await this.getInstanceStatus();
        console.log(`Server's status is "${status}".`)
        if (status === "running") {
            console.log(`Server is running.`)
            if (this.shouldShutDown()) {
                console.log(`Shutdown already scheduled. Shutting server down...`)
                const channels = this.getChannels(this.client);
                    channels.forEach((channel) => {
                        console.log(`Sending message to channel ${channel}`)
                        channel.send(
                            {content: `Shutting down the server due to inactivity...`}
                        );
                        this.cancelNextShutdown();
                    })
                this.stopInstance();
            } else {
                console.log(`Shutdown not scheduled. Done!`)
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
        // if (status === "running") {
            console.log(`Updating bot's status to online.`)
            this.client.user.setPresence({ activities: [{ name: `Minecraft (${online} online)`}], status: 'online', afk: false });
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
