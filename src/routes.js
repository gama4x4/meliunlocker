const { Router } = require('express');
const MeliScraper = require('./MeliScraper');

const routes = Router();

routes.get('/', (req, res) => {
    return res.json({
        message: 'Meliunlocker API is running'
    });
});

routes.get('/search', async (req, res) => {
    const { q } = req.query;

    if (!q) {
        return res.status(400).json({
            error: 'Query param "q" is required'
        });
    }

    const products = await MeliScraper.search(q);

    return res.json(products);
});

routes.get('/item/:id', async (req, res) => {
    const { id } = req.params;
    const item = await MeliScraper.getItem(id);

    return res.json(item);
});

routes.get('/item/:id/description', async (req, res) => {
    const { id } = req.params;
    const description = await MeliScraper.getItemDescription(id);

    return res.json(description);
});

module.exports = routes;