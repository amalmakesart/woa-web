import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://workerofart.com'
  return [
    { url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/feed`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/artists`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/gigs`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/projects`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/signup`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ]
}
