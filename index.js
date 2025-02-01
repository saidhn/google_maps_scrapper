const puppeteer = require('puppeteer');
const fs = require('fs'); // You already have this
const { stringify: csv } = require('csv-stringify'); // Correct way to import
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

//--------------- electron gui
let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), // For security best practices
            nodeIntegration: false, // Important for security
            contextIsolation: true, // Important for security
        },
    });

    mainWindow.loadFile('index.html');

    // Open DevTools (optional)
    mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// Handle data from renderer process (index.js)
ipcMain.handle('submit-data', async (event, searchKey) => {
    console.log('Received data in main process:', searchKey);
    try {
        counterValue = 0;
        run(searchKey);
        return { message: 'تم البدء' }; // Send success message back
    } catch (err) {
        console.error("Error writing file:", err);
        return { error: 'لم يتم البدء' }; // Send error message back
    }
});
let counterValue = 0;
ipcMain.handle('get-counter', async (event) => {
    return counterValue; // Return the counter value
});
//--------------- Functions
async function getInnerText(selector, page) {
    try {
        const text = await page.$eval(selector, el => el.innerText);
        return text;
    } catch (error) {
        return '';
    }
}
async function getAttribute(selector, page, attributeName) {
    try {
        const attributeValue = await page.$eval(selector, (el, attr) => el.getAttribute(attr), attributeName);
        return attributeValue;
    } catch (error) {
        console.error(`Error getting attribute "${attributeName}" for selector "${selector}":`, error);
        return ''; // Or handle the error as needed (e.g., return an empty string, throw the error)
    }
}
async function saveDataToCSV(page) {
    try {
        const mobile = (await getInnerText('[data-tooltip="Copy phone number"]', page)).replace('', '');
        const name_en = await getInnerText('div[role="main"][jslog][aria-label] h1', page);
        const name_ar = await getInnerText('div[role="main"][jslog][aria-label] h2', page);
        const location = await getInnerText('button[data-item-id="address"]', page);
        const website = await getAttribute('[data-tooltip="Open website"]', page, 'href');
        const review = await getInnerText('[data-item-id="address"]', page);
        const current_url = await page.url();

        const data = [
            mobile,
            name_en,
            name_ar,
            location,
            website,
            review,
            current_url
        ];

        const csvData = [data]; // Wrap the data in an array for csv-stringify

        // Check if the file exists. If not, add the header.
        const filePath = 'output.csv'; // Or your desired file path
        const fileExists = fs.existsSync(filePath);

        csv(csvData, {
            header: !fileExists, columns: {
                mobile: 'Mobile',
                name_en: 'Name (English)',
                name_ar: 'Name (Arabic)',
                location: 'Location',
                website: 'Website',
                review: 'Review',
                current_url: 'Current URL'
            }
        }, (err, output) => {
            if (err) {
                console.error('Error converting to CSV:', err);
                return;
            }

            // Write with UTF-8 encoding
            fs.appendFile(filePath, output, { encoding: 'utf8' }, (err) => {  // Key change here
                if (err) {
                    console.error('Error appending to CSV file:', err);
                } else {
                    console.log('Data appended to CSV file (UTF-8).');
                }
            });

        });


    } catch (error) {
        console.error('Error saving data:', error);
    }
}

//----------------- run
async function run(searchKey) {

    // Launch the browser and open a new blank page
    const browser = await puppeteer.launch({ headless: false });
    const page = (await browser.pages())[0];
    try {
        // Navigate the page to a URL.
        await page.goto('https://www.google.com/maps/@21.5223207,39.2044759,12.83z?entry=ttu&g_ep=EgoyMDI1MDEyOS4xIKXMDSoASAFQAw%3D%3D', { timeout: 150000, waitUntil: 'networkidle2' });
    } catch (error) {
        console.error('Navigation timeout:', error);
        // Handle the error, e.g., retry or exit
    }
    // Set screen size.
    await page.setViewport({ width: 1080, height: 1024 });

    // Type into search box.
    await page.locator('#searchboxinput').fill(searchKey);
    await page.locator('#searchbox-searchbutton').click();

    // Wait for the search results to load.
    await page.waitForSelector(
        'text/Results',
    );
    let results = await page.$$('a[class][aria-label][jsaction][jslog]');

    console.log('Number of search results:', results.length);
    if (results.length > 0) {
        // Loop through each result
        for (let i = 0; i < results.length; i++) {
            counterValue = i;
            console.log(`Clicking on result ${i + 1}`);

            // Click on the current result
            await results[i].click({ preventDefault: true });

            // check if the pop up is opened or try again
            try {
                await page
                    .locator('button[aria-label="Close"][jscontroller][jsaction]')
                    .waitHandle({ timeout: 2000 });
            } catch {
                i--; //minus i to try again
                continue;
            }

            // check if the mobile number is available or go next
            try {
                textSelector = await page
                    .locator('[data-tooltip="Copy phone number"]')
                    .waitHandle({ timeout: 2000 });

                await saveDataToCSV(page);

            } catch {
                //close the popup window
                await page.locator('button[aria-label="Close"][jscontroller][jsaction]').click();

                continue;
            }

            // close the dialog
            await page.locator('button[aria-label="Close"][jscontroller][jsaction]').click();
            try {
                await new Promise(r => setTimeout(r, 2000));
            } catch (error) {
                console.error('Dialog closed timeout:', error);
            }
            //scroll to bottom
            await page.evaluate(() => {
                document.querySelector('div[aria-label][role="feed"]').scrollTop += document.querySelector('a[class][aria-label][jsaction][jslog]').clientHeight;
            });

            //refresh results
            results = await page.$$('a[class][aria-label][jsaction][jslog]');

        }
    } else {
        console.log('No search results found.');
    }

    await browser.close();
} 
