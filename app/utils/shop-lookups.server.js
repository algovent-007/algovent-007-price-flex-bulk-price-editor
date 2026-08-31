const LOOKUP_CACHE_TTL_MS = 60_000;
const lookupCache = new Map();

export async function fetchCollectionsAndLocations(admin, shop) {
  const cacheKey = shop || "";
  if (cacheKey) {
    const cached = lookupCache.get(cacheKey);
    if (cached && Date.now() - cached.at < LOOKUP_CACHE_TTL_MS) {
      return cached.value;
    }
  }

  const response = await admin.graphql(
    `#graphql
    query getCollectionsAndLocations {
      collections(first: 250, sortKey: TITLE) {
        nodes {
          id
          title
        }
      }
      locations(first: 250) {
        nodes {
          id
          name
        }
      }
    }`,
  );
  const json = await response.json();
  if (json.errors) {
    throw new Error(json.errors[0].message);
  }
  const value = {
    collections: json.data?.collections?.nodes || [],
    locations: json.data?.locations?.nodes || [],
  };
  if (cacheKey) {
    lookupCache.set(cacheKey, { at: Date.now(), value });
  }
  return value;
}
