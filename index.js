const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        timeout: 60000,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

const OWNER_NAME = "𝕊𝕟𝕠𝕨𝕎𝕙𝕚𝕥𝕖💦";
const approvedGroups = new Set();

// Cache folder for temporary downloads
const cacheFolder = path.join(__dirname, 'temp_cache');
if (!fs.existsSync(cacheFolder)) {
    fs.mkdirSync(cacheFolder);
}

// ---------------------------------------------------------
// GOOGLE DRIVE PUBLIC FOLDER & DIRECT FALLBACK URL CONFIG
// ---------------------------------------------------------
const DRIVE_FOLDER_LINK = "https://drive.google.com/your-main-study-folder";

// Direct File Downloader Function
async function fetchAndSaveFile(fileUrl, outputPath) {
    const writer = fs.createWriteStream(outputPath);
    const response = await axios({
        url: fileUrl,
        method: 'GET',
        responseType: 'stream'
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

client.on('qr', (qr) => {
    console.log('\n--- SCAN THIS QR CODE WITH YOUR BOT WHATSAPP NUMBER ---\n');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log(`\n✅ Bot Successfully Online! Owner: ${OWNER_NAME}\n`);
    console.log("Listening for !activate command in groups...\n");
});

client.on('message_create', async (msg) => {
    try {
        const text = msg.body.trim().toLowerCase();

        // A. ACTIVATION COMMANDS
        if (text === '!activate') {
            approvedGroups.add(msg.from);
            console.log(`[SUCCESS] Bot Activated in Chat ID: ${msg.from}`);
            await msg.reply(`✅ *Bot Activated Successfully!*\n\n👑 *Owner:* ${OWNER_NAME}\nIs group mein auto-replies aur Google Drive Auto-Sync active hai.`);
            return;
        }

        if (text === '!deactivate') {
            approvedGroups.delete(msg.from);
            console.log(`[SUCCESS] Bot Deactivated in Chat ID: ${msg.from}`);
            await msg.reply(`❌ *Bot Deactivated!*\n\n👑 *Owner:* ${OWNER_NAME}`);
            return;
        }

        // B. APPROVED GROUPS LOGIC
        if (approvedGroups.has(msg.from)) {
            const chat = await msg.getChat();

            // --- FEATURE 1: ANTI-LINK PROTECTION ---
            const linkRegex = /(chat\.whatsapp\.com|whatsapp\.com\/channel|https?:\/\/|www\.)/i;
            if (linkRegex.test(msg.body) && !msg.fromMe) {
                try {
                    await msg.delete(true);
                    const contact = await msg.getContact();
                    await chat.sendMessage(`⚠️ *WARNING!* @${contact.id.user}\nGroup mein link share karna allow nahi hai! Message delete kar diya gaya hai.`, {
                        mentions: [contact]
                    });
                    return;
                } catch (err) {
                    console.log('Delete Link Error:', err.message);
                }
            }

            // --- FEATURE 2: AUTO-DRIVE & ONLINE FILE FETCHING ---
            const subjectMatch = text.match(/\b([a-z]{2,4}\s*\d{3}[p]?)\b/i);
            if (subjectMatch) {
                const detectedSubject = subjectMatch[0].toUpperCase().replace(/\s+/g, '');
                const localFilePath = path.join(cacheFolder, `${detectedSubject}.pdf`);

                // Check if file is already in temporary cache
                if (fs.existsSync(localFilePath)) {
                    const media = MessageMedia.fromFilePath(localFilePath);
                    await chat.sendMessage(media, {
                        caption: `📚 *${detectedSubject} Handouts*\n\n_Fetched from Storage by Admin ${OWNER_NAME}_`
                    });
                    return;
                }

                // If not in cache, Auto-Fetch from Online Source
                await msg.reply(`⏳ *Downloading ${detectedSubject} PDF from Drive/Server... Please wait.*`);

                // VU Official Direct Handout Fallback URL
                const directOnlineUrl = `https://vulms.vu.edu.pk/Handouts/${detectedSubject}.pdf`;

                try {
                    await fetchAndSaveFile(directOnlineUrl, localFilePath);

                    const media = MessageMedia.fromFilePath(localFilePath);
                    await chat.sendMessage(media, {
                        caption: `📚 *${detectedSubject} Handouts & Study Material*\n\n_Auto-Fetched by Admin ${OWNER_NAME}_`
                    });

                } catch (fetchErr) {
                    console.log(`Auto-download failed for ${detectedSubject}:`, fetchErr.message);
                    
                    // Fallback to Google Drive Folder Link if file fails to stream directly
                    await msg.reply(`📚 *${detectedSubject} Study Material Link:*\nDirect PDF auto-download issue. Access full Drive folder here:\n${DRIVE_FOLDER_LINK}\n\n_Managed by Admin ${OWNER_NAME}_`);
                }
                return;
            }
        }
    } catch (error) {
        console.log("Error handling message:", error.message);
    }
});

console.log("Starting WhatsApp Client...");
client.initialize();