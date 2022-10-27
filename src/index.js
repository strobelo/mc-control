require('dotenv').config()
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { MinecraftServer } = require('./minecraft')
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const minecraft = new MinecraftServer(client);

const seconds = 1000;
const minutes = 60 * seconds;


client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  minecraft.updateStatus();
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  console.log(`Received command interaction: ${interaction.commandName}`)

  if (interaction.commandName === 'ping') {
    await interaction.reply({content: `Pong, ${interaction.member.displayName}!`, ephemeral: true});
  }

  if (interaction.commandName === 'mc') {
    console.log(`Handling subcommand ${interaction.options.getSubcommand()}.`)
    if (interaction.options.getSubcommand() === "status") {
        await interaction.reply({content: `Getting the Minecraft Server's status. Please wait...`, ephemeral: true});
        let instanceStatus = await minecraft.getInstanceStatus();
        await interaction.followUp({content: `The Minecraft Server is currently ${instanceStatus}.`, ephemeral: true});
    }

    if (interaction.options.getSubcommand() === "online") {
        await interaction.reply({content: `Getting the Minecraft Server's status. Please wait...`, ephemeral: true});
        let numPlayers = await minecraft.getNumPlayersOnline();
        let playersSample = await minecraft.getOnlinePlayersSample();
        let message = `The Minecraft Server currently has ${numPlayers} online.`
        playersSample.forEach(p => {
            message = message + `\n\t\`${p}\``
        })
        await interaction.followUp({content: message, ephemeral: true});
    }

    if (interaction.options.getSubcommand() === "info") {
        const address = await minecraft.getServerHost()
        await interaction.reply({content: `Modpack: [All of Fabric 5](https://www.curseforge.com/minecraft/modpacks/all-of-fabric-5)\nServer: \`${address}\``, ephemeral: true});
    }

    if (interaction.options.getSubcommand() === "stop") {
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("mc-save-stop-server")
                    .setLabel("Save and stop the server (Recommended)")
                    .setStyle(ButtonStyle.Success)
            )
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("mc-stop-server")
                    .setLabel("Force Stop the server")
                    .setStyle(ButtonStyle.Danger)
            )
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("mc-cancel")
                    .setLabel("Cancel")
                    .setStyle(ButtonStyle.Secondary)
            )
        await interaction.reply({content: `Are you sure you want to stop the server?`, components: [actionRow], ephemeral: true});
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
        await interaction.reply({content: `Are you sure you want to start the server?`, components: [actionRow], ephemeral: true});
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
        await interaction.reply({content: `Are you sure you want to create a backup?`, components: [actionRow], ephemeral: true});
    }

    if (interaction.options.getSubcommand() === "stop-if-empty") {
        await interaction.reply({content: "Beginning 'stop if empty' sequence.", ephemeral: true});
        minecraft.attemptShutdownIfEmpty(client);
    }

    if (interaction.options.getSubcommand() === "update-status") {
        await interaction.reply({content: "Beginning the 'update bot status' sequence.", ephemeral: true});
        await minecraft.updateStatus();
    }

    if (interaction.options.getSubcommand() === 'save') {
        try {
            await interaction.reply({content: `Saving the server. Please wait...`, ephemeral: true});
            await minecraft.sendSaveCommand();
            await new Promise(resolve => setTimeout(resolve, 15 * seconds));
            await interaction.followUp({content: `Save completed.`, ephemral: true});
        } catch {
            await interaction.followUp({content: `Warning: Save may not have completed successfully.`, ephemeral: true})
        }
    }

    if (interaction.options.getSubcommand() === 'say') {
        const message = interaction.options.getString("message");
        await minecraft.sendSayCommand(message);
        await interaction.reply({content: `Message sent.`, ephemeral: true});
    }

    if (interaction.options.getSubcommand() === 'refresh') {
        minecraft.cancelShutdown();
        await interaction.reply({content: `Server refreshed.`, ephemeral: true});
    }
  }

});

client.on('interactionCreate', async interaction => {
	if (!interaction.isButton()) return;
        if (interaction.customId === 'mc-stop-server') {
            await interaction.update({content: `Stopping the server. Please wait...`, components: [], ephemeral: true});
            await minecraft.stopInstance();
            await interaction.followUp({content: `Server is now stopping.`, ephemeral: true});
        }

        if (interaction.customId === 'mc-save-stop-server') {
            await interaction.update({content: `Saving and shutting down. Please wait...`, components: []});
            try {
                await minecraft.sendSaveCommand();
                await new Promise(resolve => setTimeout(resolve, 15 * seconds));
                await interaction.followUp({content: `Save completed. Stopping server...`, ephemeral: true});
                await minecraft.stopInstance();
                await interaction.followUp({content: `Server is now stopping.`, ephemeral: true});
            } catch {
                await interaction.followUp({content: `Save may not have succeeded. Aborting stop.`, ephemeral: true})
            }
        }

        if (interaction.customId === 'mc-backup-server') {
            await interaction.update({content: `Creating a backup. Please wait...`, components: []});
            await minecraft.startSnapshot();
            await interaction.followUp({content: `Backup created.`, ephemeral: true});
        }

        if (interaction.customId === 'mc-start-server') {
            await interaction.update({content: `Starting the server. Please wait...`, components: []});
            await minecraft.startInstance();
            await interaction.followUp({content: `Server is now starting. Please wait a few minutes for the server to start. You can check the server's status using \`/mc status\`.`, ephemeral: true});
        }

        if (interaction.customId === 'mc-cancel') {
            await interaction.update({content: `Cancelled.`, components: []});
        }

        if (interaction.customId === 'mc-cancel-shutdown') {
            await interaction.update({content: `Cancelled shutdown.`, components: []});
            minecraft.cancelShutdown();
        }
});

const update_shutdown_schedule_every = parseInt(process.env.UPDATE_SHUTDOWN_SCHEDULE_EVERY);
const update_status_every = parseInt(process.env.UPDATE_STATUS_EVERY);

setInterval(minecraft.updateShutdownSchedule.bind(minecraft), update_shutdown_schedule_every * minutes)
setInterval(minecraft.updateStatus.bind(minecraft), update_status_every * minutes)

client.login(process.env.BOT_TOKEN);
