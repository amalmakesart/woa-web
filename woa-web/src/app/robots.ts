import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/profile/', '/messages/', '/notifications/'] },
    sitemap: 'https://workerofart.com/sitemap.xml',
  }
}
