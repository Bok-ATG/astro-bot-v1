// "reads" images and finds questions

const { OpenAI } = require('openai');
const axios = require('axios');
const log = require('../utils/log');

class VisionBot {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    log.bot('vision', 'ready to look at your pictures');
  }

  // grab the image from slack's secret stash
  async downloadImage(imageUrl) {
    try {
      log.bot('vision', 'Downloading image from Slack');
      
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        headers: { 
          Authorization: `Bearer ${process.env.SLACK_USER_TOKEN}` 
        },
      });
      
      const imageBuffer = Buffer.from(response.data, 'binary');
      log.success(`Image downloaded successfully (${imageBuffer.length} bytes)`);
      
      return imageBuffer;
    } catch (error) {
      log.error('Failed to download image from Slack', error);
      throw new Error('couldn\'t grab the image, try uploading again');
    }
  }

  // ask gpt-4 vision what it sees in the image
  async extractTextFromImage(imageBuffer, mimeType) {
    try {
      log.openai('Analyzing image with GPT-4 Vision');
      
      const visionResponse = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this image carefully. If it contains any questions, problems, or text that appears to be asking for help or explanation, extract that content exactly as written. 

If the image contains:
- Questions or problems to solve
- Text asking for explanations
- Academic content needing clarification
- Any request for help or information

Return the extracted text. If the image contains no questions or requests for help, respond with exactly: NO_QUESTION_FOUND`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${imageBuffer.toString('base64')}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 1000
      });

      const extractedText = visionResponse.choices[0]?.message?.content?.trim();
      
      if (extractedText && extractedText !== 'NO_QUESTION_FOUND') {
        log.success('Successfully extracted text from image');
        log.debug('Extracted content preview', { 
          preview: extractedText.substring(0, 150) + '...' 
        });
        return extractedText;
      } else {
        log.info('No questions or text found in image');
        return null;
      }
    } catch (error) {
      log.error('Failed to analyze image with GPT-4 Vision', error);
      throw new Error('couldn\'t read the image, try again');
    }
  }

  // main image processing pipeline
  async processImageFile(file) {
    try {
      log.bot('vision', `Processing ${file.mimetype} image: ${file.name}`);
      
      if (!file.mimetype || !file.mimetype.startsWith('image/')) {
        log.warning('not an image, moving on');
        return null;
      }

      // Download the image
      const imageBuffer = await this.downloadImage(file.url_private);
      
      // Extract text using vision
      const extractedText = await this.extractTextFromImage(imageBuffer, file.mimetype);
      
      if (extractedText) {
        log.bot('vision', 'Image processing completed - text extracted successfully');
        return extractedText;
      } else {
        log.bot('vision', 'Image processing completed - no questions found');
        return null;
      }
    } catch (error) {
      log.error('Error processing image file', error);
      throw error;
    }
  }

  // handle multiple images at once (because why not)
  async processMultipleImages(files) {
    const results = [];
    
    log.bot('vision', `Processing ${files.length} uploaded files`);
    
    for (const file of files) {
      try {
        const extractedText = await this.processImageFile(file);
        if (extractedText) {
          results.push({
            filename: file.name,
            text: extractedText,
            success: true
          });
        }
      } catch (error) {
        log.warning(`failed to process ${file.name}`, error);
        results.push({
          filename: file.name,
          text: null,
          success: false,
          error: error.message
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    log.bot('vision', `Batch processing complete: ${successCount}/${files.length} files processed successfully`);
    
    return results;
  }

  // check if we can actually read this image format
  isProcessableImage(file) {
    const supportedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
      'image/webp', 'image/bmp', 'image/tiff'
    ];
    
    return file.mimetype && supportedTypes.includes(file.mimetype.toLowerCase());
  }
}

module.exports = VisionBot;
