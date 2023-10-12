import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();
const port = process.env.PORT || 8080;
const app = express();

app.use(cors());
app.use(express.json());

// Define your Shopify store credentials
const shopifyApiUrl = `https://${process.env.STORE_URL}/admin/api/2023-10/graphql.json`; // Replace with your shop's URL
const shopifyApiAccessToken = process.env.SHOPIF_API_PASS_WITH_TOKEN; // Replace with your API access token

// Endpoint to update an image on Shopify
app.get("/update-image", async (req, res) => {
  try {
    // Send a GraphQL mutation to Shopify to update an image
    const response = await fetch(shopifyApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": shopifyApiAccessToken,
      },
      body: JSON.stringify({
        query:
          `mutation fileUpdate($input: [FileUpdateInput!]!) {
            fileUpdate(files: $input) {
              files {
                ... on MediaImage { 
                  id 
                  image { 
                    url 
                  } 
                } 
              } 
              userErrors { 
                message 
              } 
            } 
          }`,
        variables: {
          input: {
            id: "gid://shopify/MediaImage/34709575991584",
            originalSource:
              "https://fastly.picsum.photos/id/543/700/500.jpg?hmac=udAfUnwR_YYHMdWiooJXL7zTtOs0PDfXfzlT2et3DiM",
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed with status ${response.status}`);
    }

    const data = await response.json();
    res.json({ data });
  } catch (error) {
    console.error("Error fetching product images from Shopify:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Endpoint to fetch product images from Shopify
app.get("/product-images", async (req, res) => {
  try {
    // Make a GraphQL request to Shopify to fetch all products and their images
    const response = await fetch(shopifyApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": shopifyApiAccessToken,
      },
      body: JSON.stringify({
        query: `query {
          files(first: 27) {
            edges {
              node {
                ... on MediaImage {
                  id
                  image {
                    id
                    originalSrc: url
                    width
                    height
                  }
                }
              }
            }
          }
        }`,
      }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed with status ${response.status}`);
    }

    const data = await response.json();

    const responseData = data.data; // Assuming that the data is stored in a 'data' field

    if (responseData && responseData.files && responseData.files.edges) {
      // Extract the array of media images from the response
      const mediaImages = responseData.files.edges;

      // Loop through the mediaImages array to process each image
      for (const imageInfo of mediaImages) {
        // Get the unique ID for this MediaImage (for changing image)
        const MediaImageId = imageInfo.node.id;

        // Check if the image source exists and extract it (this is the actual image source that needs optimization)
        const MediaImageSrc = imageInfo.node?.image?.originalSrc;

        // Log the MediaImageId and its source for debugging or further processing

        // Now you can optimize the MediaImageSrc as needed
        // After optimization, you can update the image source by calling the API again with MediaImageId
      }
    } else {
      // Log an error message if the data structure is not as expected
      console.error("Data structure is not as expected.");
    }    

    res.json({ data });
  } catch (error) {
    console.error("Error fetching product images from Shopify:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
