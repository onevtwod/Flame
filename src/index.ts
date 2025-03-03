import { Client, GatewayIntentBits, Message, TextChannel, REST, Routes, ApplicationCommandType, ChatInputCommandInteraction } from 'discord.js';
import { config } from 'dotenv';
import { TwitterApi } from 'twitter-api-v2';
import cron from 'node-cron';
import OpenWeatherMap from 'openweathermap-ts';
import { TWITTER_ACCOUNTS, DISCORD_CHANNELS, WEATHER_CONFIG } from './config';
import { cryptoVocabulary, CryptoWord } from './cryptoVocab';

// Load environment variables
config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// Initialize Twitter client
const twitterClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN!);

// Initialize OpenWeatherMap
const weatherClient = new OpenWeatherMap({
    apiKey: WEATHER_CONFIG.API_KEY
});

// Keep track of processed tweets to avoid duplicates
const processedTweets = new Set<string>();

// Add this near the top with other global variables
const activeGames = new Map<string, CryptoWord>();

// Function to fetch and send tweets
async function checkAndSendTweets() {
    try {
        for (const account of TWITTER_ACCOUNTS) {
            // Get user ID from username
            const user = await twitterClient.v2.userByUsername(account.username);
            if (!user.data) continue;

            // Get recent tweets
            const tweets = await twitterClient.v2.userTimeline(user.data.id, {
                exclude: ['retweets', 'replies'],
                max_results: 5,
            });

            for (const tweet of tweets.data.data) {
                // Skip if we've already processed this tweet
                if (processedTweets.has(tweet.id)) continue;

                // Mark tweet as processed
                processedTweets.add(tweet.id);

                // Format message
                const message = `**New post from ${account.name}**\n\n${tweet.text}\n\nLink: https://twitter.com/${account.username}/status/${tweet.id}`;

                // Send to all guilds
                client.guilds.cache.forEach(async (guild) => {
                    const channel = guild.channels.cache.find(
                        ch => ch.name === DISCORD_CHANNELS.CRYPTO.replace('💰-', '')
                    ) as TextChannel;

                    if (channel) {
                        await channel.send(message);
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error fetching tweets:', error);
    }
}

// Define slash commands
const commands = [
    {
        name: 'weather',
        description: 'Get current weather forecast',
    },
    {
        name: 'help',
        description: 'Show all available commands',
    }
];

// Register commands when bot is ready
client.once('ready', async () => {
    console.log(`Logged in as ${client.user?.tag}!`);

    // Register slash commands
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationCommands(client.user!.id),
            { body: commands }
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }

    // Initial check
    checkAndSendTweets();

    // Schedule regular checks
    cron.schedule('*/5 * * * *', checkAndSendTweets);

    // Add this cron job (runs daily at 8 AM)
    cron.schedule('0 8 * * *', async () => {
        const weatherChannel = client.channels.cache.get(DISCORD_CHANNELS.WEATHER) as TextChannel;
        if (weatherChannel) {
            await sendWeatherForecast(weatherChannel);
        }
    });
});

// Handle slash commands
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    switch (interaction.commandName) {
        case 'weather':
            await interaction.deferReply();
            await sendWeatherForecast(interaction);
            break;

        case 'help':
            await interaction.reply({
                content: `**Available Commands:**
• \`/weather\` - Get current weather forecast
• \`/help\` - Show this help message`,
                ephemeral: true
            });
            break;
    }
});

// Update weather function to handle both channel and interaction
async function sendWeatherForecast(target: TextChannel | ChatInputCommandInteraction) {
    try {
        const forecast = await weatherClient.getCurrentWeatherByCityName({
            cityName: WEATHER_CONFIG.CITY
        });

        const message = `
🌤️ **Current Weather for ${WEATHER_CONFIG.CITY}**
Temperature: ${forecast.main.temp}°C
Humidity: ${forecast.main.humidity}%
Weather: ${forecast.weather[0].description}
`;

        if (target instanceof TextChannel) {
            await target.send(message);
        } else {
            await target.editReply(message);
        }
    } catch (error) {
        console.error('Error fetching weather:', error);
        if (target instanceof ChatInputCommandInteraction) {
            await target.editReply('Sorry, there was an error fetching the weather forecast.');
        }
    }
}

// Subject channel mappings
const subjectChannels = {
    history: '📚-history',
    maths: '🔢-mathematics',
    english: '📝-english',
    malay: '🇲🇾-bahasa-melayu',
    biology: '🧬-biology',
    chemistry: '🧪-chemistry'
};

// Handle messages
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const content = message.content.toLowerCase();

    // Handle subject channels
    Object.entries(subjectChannels).forEach(([subject, channel]) => {
        if (content.includes(subject)) {
            message.reply(`Please head to the ${channel} channel for ${subject}-related discussions!`);
        }
    });

    // Handle weather command
    if (content === '!weather' && message.channel instanceof TextChannel) {
        await sendWeatherForecast(message.channel);
    }

    // Handle guess game commands
    if (content === '!guess') {
        // Start a new game
        const randomWord = cryptoVocabulary[Math.floor(Math.random() * cryptoVocabulary.length)];
        activeGames.set(message.channel.id, randomWord);

        const gameMessage = `
🎮 **Crypto Word Guessing Game**
Can you guess the crypto-related word?

${randomWord.emoji} ${hideWord(randomWord.word)}
💡 Hint: ${randomWord.hint}

Type your guess in the chat!
`;
        await message.channel.send(gameMessage);
    } else if (activeGames.has(message.channel.id)) {
        // Check if it's a guess for an active game
        const currentGame = activeGames.get(message.channel.id)!;

        if (content === currentGame.word.toLowerCase()) {
            // Correct guess
            await message.reply(`🎉 Congratulations! You got it right! The word was **${currentGame.word}**!`);
            activeGames.delete(message.channel.id);
        } else if (content.startsWith('!hint')) {
            // Provide an additional hint
            await message.channel.send(`💡 Additional hint: The word has ${currentGame.word.length} letters.`);
        } else if (content === '!giveup') {
            // Give up
            await message.channel.send(`Game Over! The word was **${currentGame.word}**`);
            activeGames.delete(message.channel.id);
        }
    }
});

// Add this helper function
function hideWord(word: string): string {
    return word.replace(/[a-zA-Z]/g, '_ ');
}

// Login to Discord
client.login(process.env.DISCORD_TOKEN); 