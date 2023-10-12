import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch, { FormData } from "node-fetch";
import tinify from "tinify";
import fs from "fs";

dotenv.config();
const port = process.env.PORT || 8080;
const app = express();

app.use(cors());
app.use(express.json());

// Define your Shopify store credentials
const shopifyApiUrl = `https://${process.env.STORE_URL}/admin/api/2023-10/graphql.json`; // Replace with your shop's URL
//imgbb api with api key
const imgBBapi = `https://api.imgbb.com/1/upload?expiration=1000&key=${process.env.IMG_BB_API_KEY}`;
const shopifyApiAccessToken = process.env.SHOPIF_API_PASS_WITH_TOKEN; // Replace with your API access token
tinify.key = process.env.TINIFY_API_KEY;

// post to shopify
async function postToShopify(images) {
  let message = {};
  try {
    for (const imageInfo of images) {
      const mediaImageId = imageInfo.mediaImageId;
      const cdnUrl = imageInfo.liveUrl;
      // Send a GraphQL mutation to Shopify to update an image
      const response = await fetch(shopifyApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": shopifyApiAccessToken,
        },
        body: JSON.stringify({
          query: `mutation fileUpdate($input: [FileUpdateInput!]!) {
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
              id: mediaImageId,
              originalSource: cdnUrl,
            },
          },
        }),
      });
      if (!response.ok) {
        message = {error: response.status}
      }
      // Handle the API response as needed
      const responseData = await response.json();
      // You can add more logic here based on the API response
      message = responseData;
    }
  } catch (error) {
    message = {error: error}
  }
  return message;
}
// Function to fetch product images from Shopify and compress them
async function fetchImages(filesNumber) {
  const query = `
    query($filesNumber: Int) {
      files(first: $filesNumber) {
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
    }
  `;
  const response = await fetch(shopifyApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": shopifyApiAccessToken,
    },
    body: JSON.stringify({
      query: query,
      variables: { filesNumber: filesNumber },
    }),
  });

  if (!response.ok) {
    // error happen
    return [
      { message: `GraphQL request failed with status ${response.status}` },
    ];
  }
  const data = await response.json();
  const responseData = data.data;
  if (responseData && responseData.files && responseData.files.edges) {
    // Extract the array of media images from the response
    return responseData.files.edges;
  } else {
    return [{ message: "Data structure is not as expected." }];
  }
}
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
// compress images
async function compressImage(images) {
  // Loop through the mediaImages array to process each image
  const imageExtensions = [".jpg", ".jpeg", ".png", ".webp"];
  // compressed image array
  let compressedImageArray = [];
  for (const imageInfo of images) {
    // Get the unique ID for this MediaImage (for changing image)
    const mediaImageId = imageInfo.node.id;
    // Check if the image source exists and extract it (this is the actual image source that needs optimization)
    const mediaImageSrc = imageInfo.node?.image?.originalSrc;
    // check the image extension
    const imageExtension = imageExtensions.find((extension) =>
      mediaImageSrc?.includes(extension)
    );
    if (imageExtension) {
      try {
        // Use the Tinify API to compress the image
        const source = tinify.fromUrl(mediaImageSrc);
        const imageName = generateUniqueNumber() + imageExtension;
        const imagePath = "images/" + imageName;
        await source.toFile(imagePath);
        compressedImageArray.push({ mediaImageId, imagePath });
      } catch (error) {
        compressedImageArray = [
          { message: `Error compressing image: ${error}` },
        ];
        break;
      }
    }
  }
  return compressedImageArray;
}
// post image to a database for genarate public link
async function postToImgBB(images) {
  // images with publick cdn link
  let imagesWithCDN = [];
  for (const imageInfo of images) {
    const imageFilePath = imageInfo.imagePath;
    const mediaImageId = imageInfo.mediaImageId;
    const imageAsBase64 = fs.readFileSync(imageFilePath, "base64");
    const form = new FormData();
    form.append("image", imageAsBase64);
    try {
      const response = await fetch(imgBBapi, {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      imagesWithCDN.push({ mediaImageId, liveUrl: data.data.url });
    } catch (error) {
      imagesWithCDN = [{ message: `imagebb upload error: ${error}` }];
    }
  }
  return imagesWithCDN;
}

// Endpoint to fetch and compress product images from Shopify
app.get("/product-images", async (req, res) => {
  // pass the number of files you want to fetch dynamically
  const images = await fetchImages(3);
  if (images[0] && images[0].message) {
    return res.status(500).json({ error: images[0].message });
  }
  // get compressed images with local file locaton and shopify image id
  const compressedImageswithId = await compressImage(images);
  if (compressedImageswithId[0] && compressedImageswithId[0].message) {
    return res.status(500).json({ error: compressedImageswithId[0].message });
  }
  // save images on database for genarate cdn link
  const imagesWithCDN = await postToImgBB(compressedImageswithId);
  if (imagesWithCDN[0] && imagesWithCDN[0].message) {
    return res.status(500).json({ error: imagesWithCDN[0].message });
  }
  const shopifyPost = await postToShopify(imagesWithCDN);
  res.json({ data: shopifyPost });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
