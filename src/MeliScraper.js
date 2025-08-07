const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

class MeliScraper {
    static async search(query) {
        const browser = await this.init();
        const page = await browser.newPage();
        await page.goto(`https://lista.mercadolivre.com.br/${query}`);

        const products = await page.evaluate(() => {
            const products = [];
            const elements = document.querySelectorAll('.ui-search-result__wrapper');

            for (const element of elements) {
                const title = element.querySelector('.ui-search-item__title')?.innerText;
                const price = element.querySelector('.price-tag-fraction')?.innerText;
                const link = element.querySelector('.ui-search-link')?.href;
                const image = element.querySelector('.ui-search-result-image__element')?.src;

                products.push({ title, price, link, image });
            }

            return products;
        });

        await browser.close();
        return products;
    }

    static async getItem(id) {
        const browser = await this.init();
        const page = await browser.newPage();
        await page.goto(`https://produto.mercadolivre.com.br/MLB-${id}`);

        const item = await page.evaluate(() => {
            const title = document.querySelector('.ui-pdp-title')?.innerText;
            const price = document.querySelector('.andes-money-amount__fraction')?.innerText;
            
            const pictures = [];
            const elements = document.querySelectorAll('.ui-pdp-gallery__figure__image');
            for (const element of elements) {
                pictures.push(element.src);
            }

            return { title, price, pictures };
        });

        await browser.close();
        return item;
    }

    static async getItemDescription(id) {
        const browser = await this.init();
        const page = await browser.newPage();
        await page.goto(`https://produto.mercadolivre.com.br/MLB-${id}`);

        const description = await page.evaluate(() => {
            const plain_text = document.querySelector('.ui-pdp-description__content')?.innerText;
            
            return { plain_text };
        });

        await browser.close();
        return description;
    }

    static async init() {
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                `--proxy-server=${process.env.PROXY_URL}`
            ]
        });

        return browser;
    }
}

module.exports = MeliScraper;