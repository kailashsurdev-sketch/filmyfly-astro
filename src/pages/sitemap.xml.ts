/**
 * Dynamic Sitemap Generator for Astro Frontend
 * Fetches data from backend API and generates sitemap.xml
 */

const API_BASE = import.meta.env.PUBLIC_API_URL || 'http://localhost:8080/api';

// Fetch all data needed for sitemap
async function fetchSitemapData() {
    try {
        // Fetch ALL movies using pagination
        let allMovies: any[] = [];
        let page = 1;
        let hasMore = true;
        const limit = 500; // Fetch in batches of 500

        while (hasMore) {
            const moviesResponse = await fetch(`${API_BASE}/movies?page=${page}&limit=${limit}`);
            const moviesData = await moviesResponse.json();

            if (moviesData.success && moviesData.data && moviesData.data.length > 0) {
                allMovies = allMovies.concat(moviesData.data);

                // Check if there are more pages
                if (moviesData.pagination && moviesData.pagination.hasNextPage) {
                    page++;
                } else {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
        }

        console.log(`Sitemap: Fetched ${allMovies.length} movies`);

        // Fetch categories
        const categoriesResponse = await fetch(`${API_BASE}/categories`);
        const categoriesData = await categoriesResponse.json();
        const categories = categoriesData.success ? categoriesData.data : [];

        return { movies: allMovies, categories };
    } catch (error) {
        console.error('Error fetching sitemap data:', error);
        return { movies: [], categories: [] };
    }
}

// Helper function to escape XML special characters
function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

export async function GET() {
    const { movies, categories } = await fetchSitemapData();

    // Get site URL from environment or use default
    const siteUrl = import.meta.env.PUBLIC_SITE_URL || 'https://filmyfly.work';
    const baseUrl = siteUrl.replace(/\/$/, '');

    // Get current date for lastmod
    const currentDate = new Date().toISOString().split('T')[0];

    // Build sitemap XML
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
`;

    // 1. Homepage (highest priority)
    sitemap += `  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
`;

    // 2. Important static pages
    const staticPages = [
        { path: '/page/privacy-policy', priority: '0.7', changefreq: 'monthly' },
        { path: '/page/contact-us', priority: '0.7', changefreq: 'monthly' },
        { path: '/page/about-us', priority: '0.7', changefreq: 'monthly' },
        { path: '/page/dmca', priority: '0.7', changefreq: 'monthly' },
        { path: '/page/how-to-download-movie', priority: '0.8', changefreq: 'monthly' },
        { path: '/search', priority: '0.6', changefreq: 'weekly' }
    ];

    staticPages.forEach(page => {
        sitemap += `  <url>
    <loc>${baseUrl}${page.path}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
    });

    // 3. Category pages
    categories.forEach((category: any) => {
        sitemap += `  <url>
    <loc>${baseUrl}/category/${category.id}/${category.slug}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
`;
    });

    // 4. All movie pages (most important for SEO)
    movies.forEach((movie: any) => {
        sitemap += `  <url>
    <loc>${baseUrl}/${movie.slug}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>`;

        // Add image if thumbnail exists (for Google Images)
        if (movie.thumbnail) {
            const escapedTitle = escapeXml(movie.title);
            const escapedThumbnail = escapeXml(movie.thumbnail);

            sitemap += `
    <image:image>
      <image:loc>${escapedThumbnail}</image:loc>
      <image:title>${escapedTitle}</image:title>
    </image:image>`;
        }

        sitemap += `
  </url>
`;
    });

    // Close sitemap
    sitemap += `</urlset>`;

    // Return response with proper headers
    return new Response(sitemap, {
        status: 200,
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        }
    });
}
