require('dotenv').config()
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { MinecraftServer } = require('./minecraft')
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const minecraft = new MinecraftServer(client);

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  minecraft.updateStatus();
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  console.log(`Received command interaction: ${interaction.commandName}`)

  if (interaction.commandName === 'ping') {
    await interaction.reply(`Pong, ${interaction.member.displayName}!`);
  }

  if (interaction.commandName === 'mc') {
    console.log(`Handling subcommand ${interaction.options.getSubcommand()}.`)
    if (interaction.options.getSubcommand() === "status") {
        await interaction.reply(`Getting the Minecraft Server's status. Please wait...`);
        let instanceStatus = await minecraft.getInstanceStatus();
        await interaction.followUp(`The Minecraft Server is currently ${instanceStatus}.`);
    }

    if (interaction.options.getSubcommand() === "online") {
        await interaction.reply(`Getting the Minecraft Server's status. Please wait...`);
        let numPlayers = await minecraft.getNumPlayersOnline();
        let playersSample = await minecraft.getOnlinePlayersSample();
        let message = `The Minecraft Server currently has ${numPlayers} online.`
        playersSample.forEach(p => {
            message = message + `\n\t\`${p}\``
        })
        await interaction.followUp(message);
    }

    if (interaction.options.getSubcommand() === "info") {
        const address = await minecraft.getServerHost()
        await interaction.reply(`Modpack: [All of Fabric 5](https://www.curseforge.com/minecraft/modpacks/all-of-fabric-5)\nServer: \`${address}\``);
    }

    if (interaction.options.getSubcommand() === "stop") {
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("mc-backup-stop-server")
                    .setLabel("Create a backup first")
                    .setStyle(ButtonStyle.Success)
            )
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("mc-stop-server")
                    .setLabel("Stop the server")
                    .setStyle(ButtonStyle.Danger)
            )
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("mc-cancel")
                    .setLabel("Cancel")
                    .setStyle(ButtonStyle.Secondary)
            )
        await interaction.reply({content: `Are you sure you want to stop the server?`, components: [actionRow]});
    }

    if (interaction.options.getSubcommand() === "start") {
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("mc-start-server")
                    .setLabel("Start the server")
                    .setStyle(ButtonStyle.Success)
            )
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("mc-cancel")
                    .setLabel("Cancel")
                    .setStyle(ButtonStyle.Secondary)
            )
        await interaction.reply({content: `Are you sure you want to start the server?`, components: [actionRow]});
    }

    if (interaction.options.getSubcommand() === "backup") {
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("mc-backup-server")
                    .setLabel("Create a backup")
                    .setStyle(ButtonStyle.Success)
            )
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("mc-cancel")
                    .setLabel("Cancel")
                    .setStyle(ButtonStyle.Secondary)
            )
        await interaction.reply({content: `Are you sure you want to create a backup?`, components: [actionRow]});
    }

    if (interaction.options.getSubcommand() === "stop-if-empty") {
        await interaction.reply("Beginning 'stop if empty' sequence.");
        minecraft.attemptShutdownIfEmpty(client);
    }

    if (interaction.options.getSubcommand() === "update-status") {
        await interaction.reply("Beginning the 'update bot status' sequence.");
        await minecraft.updateStatus();
    }
  }

});

client.on('interactionCreate', async interaction => {
	if (!interaction.isButton()) return;
        if (interaction.customId === 'mc-stop-server') {
            await interaction.update({content: `Okay, stopping the server. Please wait...`, components: []});
            await minecraft.stopInstance();
            await interaction.followUp(`Server is now stopping.`);
        }

        if (interaction.customId === 'mc-backup-stop-server') {
            await interaction.update({content: `Okay, creating a backup first. Please wait...`, components: []});
            await minecraft.startSnapshot();
            await interaction.followUp(`Backup created. Stopping server...`);
            await minecraft.stopInstance();
            await interaction.followUp(`Server is now stopping.`);
        }

        if (interaction.customId === 'mc-backup-server') {
            await interaction.update({content: `Okay, creating a backup. Please wait...`, components: []});
            await minecraft.startSnapshot();
            await interaction.followUp(`Backup created.`);
        }

        if (interaction.customId === 'mc-start-server') {
            await interaction.update({content: `Okay, starting the server. Please wait...`, components: []});
            await minecraft.startInstance();
            await interaction.followUp(`Server is now starting. Please wait a few minutes for the server to start. You can check the server's status using \`/mc status\`.`);
        }

        if (interaction.customId === 'mc-cancel') {
            await interaction.update({content: `Okay, cancelled.`, components: []});
        }

        if (interaction.customId === 'mc-cancel-shutdown') {
            await interaction.update({content: `Okay, cancelled shutdown.`, components: []});
            minecraft.cancelNextShutdown();
        }
});

const minutes = 60 * 1000;
const update_shutdown_schedule_every = parseInt(process.env.UPDATE_SHUTDOWN_SCHEDULE_EVERY);
const check_shutdown_schedule_every = parseInt(process.env.CHECK_SHUTDOWN_SCHEDULE_EVERY);
const update_status_every = parseInt(process.env.UPDATE_STATUS_EVERY);

// setInterval(minecraft.attemptShutdownIfEmpty.bind(minecraft), 30 * minutes)
setInterval(minecraft.updateShutdownSchedule.bind(minecraft), update_shutdown_schedule_every * minutes)
// setInterval(minecraft.checkShutdownSchedule.bind(minecraft), check_shutdown_schedule_every * minutes)
setInterval(minecraft.updateStatus.bind(minecraft), update_status_every * minutes)

client.login(process.env.BOT_TOKEN);
