export async function fetchCollectionsAndLocations(admin) {
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
  return {
    collections: json.data?.collections?.nodes || [],
    locations: json.data?.locations?.nodes || [],
  };
}
