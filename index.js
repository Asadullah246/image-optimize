import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import tinify from "tinify";

dotenv.config();
const port = process.env.PORT || 8080;
const app = express();

app.use(cors());
app.use(express.json());

// Define your Shopify store credentials
const shopifyApiUrl = `https://${process.env.STORE_URL}/admin/api/2023-10/graphql.json`; // Replace with your shop's URL
const shopifyApiAccessToken = process.env.SHOPIF_API_PASS_WITH_TOKEN; // Replace with your API access token
tinify.key = process.env.TINIFY_API_KEY;

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

// Helper function to generate a unique number
function generateUniqueNumber() {
  const generatedNumbers = new Set();
  
  while (true) {
    const uniqueNumber = Math.floor(1000000000 + Math.random() * 9000000000); // Generate a random 10-digit number
    const uniqueNumberString = uniqueNumber.toString();

    if (!generatedNumbers.has(uniqueNumberString)) {
      generatedNumbers.add(uniqueNumberString);
      return uniqueNumberString;
    }
  }
}

// Function to fetch product images from Shopify and compress them
async function fetchAndCompressProductImages() {
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
        await processImage(imageInfo);
      }
    } else {
      console.error("Data structure is not as expected.");
    }
  } catch (error) {
    console.error("Error fetching and compressing product images:", error);
    // Handle the error and respond accordingly
  }
}

// Function to process and compress an individual image
async function processImage(imageInfo) {
  // Get the unique ID for this MediaImage (for changing image)
  const mediaImageId = imageInfo.node.id;
  const imageExtensions = [".jpg", ".jpeg", ".png", ".webp"];

  // Check if the image source exists and extract it (this is the actual image source that needs optimization)
  const mediaImageSrc = imageInfo.node?.image?.originalSrc;

  // Log the MediaImageId and its source for debugging or further processing
  // Now you can optimize the MediaImageSrc as needed
  // After optimization, you can update the image source by calling the API again with MediaImageId
  const imageExtension = imageExtensions.find(extension => mediaImageSrc?.includes(extension));
  
  if (imageExtension) {
    try {
      // Use the Tinify API to compress the image
      const source = tinify.fromUrl(mediaImageSrc);
      const imageName = generateUniqueNumber();
      await source.toFile(`images/${imageName}${imageExtension}`); // Wait for the compression to finish
    } catch (error) {
      console.error("Error compressing image:", error);
    }
  }
}

// Endpoint to fetch and compress product images from Shopify
app.get("/product-images", async (req, res) => {
  await fetchAndCompressProductImages();
  res.json({ data });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
