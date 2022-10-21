const { REST, Routes, SlashCommandBuilder  } = require('discord.js');
require('dotenv').config()

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

const mcCommand = new SlashCommandBuilder()
    .setName("mc")
    .setDescription("Control the Minecraft Server.")
    .addSubcommand(subcommand =>
        subcommand
            .setName("status")
            .setDescription("Get the status of the Minecraft server"))
    .addSubcommand(subcommand =>
        subcommand
            .setName("online")
            .setDescription("Get the number of players online"))
    .addSubcommand(subcommand =>
        subcommand
            .setName("info")
            .setDescription("Get info about the Minecraft server"))
    .addSubcommand(subcommand =>
        subcommand
            .setName("start")
            .setDescription("Start the Minecraft server"))
    .addSubcommand(subcommand =>
        subcommand
            .setName("stop")
            .setDescription("Stop the Minecraft server"))
    .addSubcommand(subcommand =>
        subcommand
            .setName("backup")
            .setDescription("Start a backup of the Minecraft server"))

if (process.env.NODE_ENV === "development") {
    mcCommand.addSubcommand(subcommand =>
        subcommand
            .setName("stop-if-empty")
            .setDescription("Manually trigger the 'stop server if empty' sequence"))
    .addSubcommand(subcommand =>
        subcommand
            .setName("update-status")
            .setDescription("Manually trigger the 'update bot status' sequence"))
}

let commands = [
    mcCommand    
];

const commandsJson = commands.map(command => command.toJSON());

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');
    if (process.env.NODE_ENV == "development") {
        console.log('Development environment enabled: Syncing only guild commands for testing.');
        await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commandsJson });
    } else {
        console.log('Production environment enabled: Syncing global commands.');
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commandsJson });
    }
    

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();