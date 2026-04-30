export const APP_STORE_URL = 'https://apps.apple.com/ca/app/work-er-of-art/id6761753841';
export const WEBSITE_URL = 'https://www.workerofart.com';

export function buildProfileShareUrl(profileId: string) {
  return `${WEBSITE_URL}/artists/${profileId}`;
}

export function buildPostShareUrl(postId: string) {
  return `${WEBSITE_URL}/feed/${postId}`;
}

export function buildGigShareUrl(gigId: string) {
  return `${WEBSITE_URL}/gigs/${gigId}`;
}

export function buildProfileDeepLink(profileId: string) {
  return `workerofart://profile/${profileId}`;
}

export function buildPostDeepLink(postId: string) {
  return `workerofart://post/${postId}`;
}

export function buildGigDeepLink(gigId: string) {
  return `workerofart://gig/${gigId}`;
}
