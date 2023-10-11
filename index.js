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

app.get("/update-image", async (req, res) => {
  try {
    const query = `mutation fileUpdate($input: [FileUpdateInput!]!) { 
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
    }`;
    
    const variables = {
      input: {
        id: "gid://shopify/MediaImage/34768680845600",
        originalSource: "https://picsum.photos/700/400"
      }
    };
    
    const requestBody = {
      query: query,
      variables: variables
    };
    
    const response = await fetch(shopifyApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": shopifyApiAccessToken,
      },
      body: JSON.stringify(requestBody),
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
    res.json({ data });
  } catch (error) {
    console.error("Error fetching product images from Shopify:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
