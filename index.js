const puppeteer = require('puppeteer');

(async () => {  // Wrap in an async IIFE

    // Launch the browser and open a new blank page
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    // Navigate the page to a URL.
    await page.goto('https://www.google.com/maps/@21.5223207,39.2044759,12.83z?entry=ttu&g_ep=EgoyMDI1MDEyOS4xIKXMDSoASAFQAw%3D%3D');

    // Set screen size.
    await page.setViewport({ width: 1080, height: 1024 });

    // Type into search box.
    await page.locator('#searchboxinput').fill('مطاعم');

    // Wait and click on first result.
    await page.locator('/html/body/div[1]/div[3]/div[8]/div[9]/div/div/div[1]/div[2]/div/div[1]/div/div/div[1]/div[1]/div[3]/div/a').click();

    // Locate the full title with a unique string.
    const textSelector = await page
        .locator('[data-tooltip="Copy phone number"]')
        .waitHandle();
    const fullTitle = await textSelector?.evaluate(el => el.textContent);

    // Print the full title.
    console.log('The title of this blog post is "%s".', fullTitle);

    await browser.close();
})(); // Immediately invoke the function
