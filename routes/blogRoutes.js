import express from 'express';
import BlogPost from '../models/BlogPost.js';
import { verifyAdmin } from '../middleware/authMiddleware.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { uploadImage, uploadAttachments, handleMulterError } from '../config/fileStorage.js';
import fs from 'fs';
import mongoose from 'mongoose';
import { sendBlogToSubscribers } from '../services/emailService.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Public routes (no auth required)
router.get('/posts/public', async (req, res) => {
  console.log('GET /api/blog/posts/public - Fetching public posts');
  try {
    const posts = await BlogPost.find({ isPublished: true })
      .sort({ publishedDate: -1 })
      .select('title description content publishedDate slug category image coverImage attachments tags author updatedDate readTime');
    console.log(`Found ${posts.length} public posts`);
    res.json(posts);
  } catch (error) {
    console.error('Error fetching public posts:', error);
    res.status(500).json({ message: 'Error fetching blog posts', error: error.message });
  }
});

// Get a single public blog post by slug
router.get('/posts/:slug/public', async (req, res) => {
  const { slug } = req.params;
  try {
    const post = await BlogPost.findOne({ slug, isPublished: true });
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    res.json(post);
  } catch (error) {
    console.error('Error fetching public post:', error);
    res.status(500).json({ message: 'Error fetching blog post', error: error.message });
  }
});

// Protected routes (admin only)
// Get all blog posts (admin)
router.get('/posts', verifyAdmin, async (req, res) => {
  console.log('GET /api/blog/posts - Fetching all posts');
  try {
    const posts = await BlogPost.find()
      .sort({ publishedDate: -1 })
      .select('title description content publishedDate slug category image tags isPublished');
    console.log(`Found ${posts.length} posts`);
    res.json(posts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ message: 'Error fetching blog posts', error: error.message });
  }
});

// Get a single blog post by slug (admin)
router.get('/posts/:slug', verifyAdmin, async (req, res) => {
  const { slug } = req.params;
  try {
    const post = await BlogPost.findOne({ slug });
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    res.json(post);
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ message: 'Error fetching blog post', error: error.message });
  }
});

// Create a new blog post (admin)
router.post('/posts', verifyAdmin, async (req, res) => {
  console.log('POST /api/blog/posts - Creating new post with data:', req.body);
  try {
    const postData = {
      ...req.body,
      image: req.body.image || req.body.coverImage, // Use either image or coverImage
      coverImage: req.body.coverImage || req.body.image // Use either coverImage or image
    };

    // --- Ensure tags is always an array ---
    if (postData.tags && typeof postData.tags === 'string') {
      postData.tags = postData.tags.split(',').map(tag => tag.trim()).filter(Boolean);
    }
    if (!Array.isArray(postData.tags)) {
      postData.tags = [];
    }
    // ---------------------------------------

    console.log('Processed post data:', postData);

    // Validate required fields
    if (!postData.title || !postData.content || !postData.description) {
      return res.status(400).json({ message: 'Title, content, and description are required' });
    }

    if (!postData.image || !postData.coverImage) {
      console.log('Missing image fields:', { image: postData.image, coverImage: postData.coverImage });
      return res.status(400).json({ message: 'Cover image is required' });
    }

    const post = new BlogPost(postData);
    const savedPost = await post.save();
    console.log('Post created successfully:', savedPost.title);
    res.status(201).json(savedPost);
  } catch (error) {
    console.error('Error creating post:', error);
    if (error.code === 11000) {
      res.status(400).json({ message: 'A post with this title already exists' });
    } else if (error.name === 'ValidationError') {
      res.status(400).json({ 
        message: 'Validation error',
        details: Object.values(error.errors).map(err => err.message)
      });
    } else {
      res.status(500).json({ message: 'Error creating blog post', error: error.message });
    }
  }
});

// Update a blog post (admin)
router.put('/posts/:slug', verifyAdmin, async (req, res) => {
  console.log(`PUT /api/blog/posts/${req.params.slug} - Updating post`);
  try {
    const updateData = {
      ...req.body,
      image: req.body.image || req.body.coverImage, // Use either image or coverImage
      coverImage: req.body.coverImage || req.body.image, // Use either coverImage or image
      updatedDate: new Date()
    };

    // --- Ensure tags is always an array ---
    if (updateData.tags && typeof updateData.tags === 'string') {
      updateData.tags = updateData.tags.split(',').map(tag => tag.trim()).filter(Boolean);
    }
    if (!Array.isArray(updateData.tags)) {
      updateData.tags = [];
    }
    // ---------------------------------------

    // Validate required fields
    if (!updateData.title || !updateData.content || !updateData.description) {
      return res.status(400).json({ message: 'Title, content, and description are required' });
    }

    if (!updateData.image || !updateData.coverImage) {
      return res.status(400).json({ message: 'Cover image is required' });
    }

    const post = await BlogPost.findOneAndUpdate(
      { slug: req.params.slug },
      updateData,
      { new: true, runValidators: true }
    );

    if (!post) {
      console.log('Post not found');
      return res.status(404).json({ message: 'Blog post not found' });
    }

    console.log('Post updated successfully:', post.title);
    res.json(post);
  } catch (error) {
    console.error('Error updating post:', error);
    if (error.code === 11000) {
      res.status(400).json({ message: 'A post with this title already exists' });
    } else if (error.name === 'ValidationError') {
      res.status(400).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Error updating blog post', error: error.message });
    }
  }
});

// Delete a blog post
router.delete('/posts/:identifier', verifyAdmin, async (req, res) => {
  try {
    const { identifier } = req.params;
    console.log('Attempting to delete post with identifier:', identifier);

    // Try to find the post by ID if valid, otherwise by slug
    let post = null;
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      post = await BlogPost.findById(identifier);
    }
    if (!post) {
      post = await BlogPost.findOne({ slug: identifier });
    }

    if (!post) {
      console.log('Post not found:', identifier);
      return res.status(404).json({ message: 'Blog post not found' });
    }

    // Delete associated files
    if (post.image) {
      const imagePath = path.join(__dirname, '..', 'uploads', path.basename(post.image));
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    if (post.attachments && post.attachments.length > 0) {
      post.attachments.forEach(attachment => {
        const filePath = path.join(__dirname, '..', 'uploads', path.basename(attachment.url));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    }

    // Delete the post
    await BlogPost.deleteOne({ _id: post._id });
    console.log('Post deleted successfully:', post._id);
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ message: 'Error deleting blog post', error: error.message });
  }
});

// Get posts by category (public)
router.get('/category/:category', async (req, res) => {
  console.log(`GET /api/blog/category/${req.params.category} - Fetching posts by category`);
  try {
    const posts = await BlogPost.find({ 
      category: req.params.category,
      isPublished: true 
    }).sort({ publishedDate: -1 });
    res.json(posts);
  } catch (error) {
    console.error('Error fetching posts by category:', error);
    res.status(500).json({ message: 'Error fetching posts by category', error: error.message });
  }
});

// Upload cover image
router.post('/upload-image', verifyAdmin, uploadImage.single('image'), handleMulterError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    console.log('Image uploaded successfully:', imageUrl);
    
    res.json({ 
      success: true, 
      message: 'Image uploaded successfully',
      imageUrl 
    });
  } catch (error) {
    // Delete the uploaded file if there's an error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Error uploading image:', error);
    res.status(500).json({ message: error.message });
  }
});

// Upload attachments
router.post('/upload-attachments', verifyAdmin, uploadAttachments.array('files', 5), handleMulterError, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const attachments = req.files.map(file => ({
      name: file.originalname,
      url: `/uploads/${file.filename}`,
      type: file.mimetype
    }));

    res.json({ 
      success: true, 
      message: 'Files uploaded successfully',
      attachments 
    });
  } catch (error) {
    // Delete uploaded files if there's an error
    if (req.files) {
      req.files.forEach(file => {
        fs.unlinkSync(file.path);
      });
    }
    res.status(500).json({ message: error.message });
  }
});

// Delete an attachment
router.delete('/posts/:postId/attachments/:attachmentId', verifyAdmin, async (req, res) => {
  try {
    const { postId, attachmentId } = req.params;
    
    const post = await BlogPost.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Blog post not found' });
    }

    // Find the attachment to delete
    const attachment = post.attachments.find(att => att._id.toString() === attachmentId);
    if (!attachment) {
      return res.status(404).json({ message: 'Attachment not found' });
    }

    // Delete the file from the filesystem
    const filePath = path.join(process.cwd(), attachment.url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Remove the attachment from the post
    post.attachments = post.attachments.filter(att => att._id.toString() !== attachmentId);
    await post.save();

    res.json({ message: 'Attachment deleted successfully' });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(500).json({ message: 'Error deleting attachment', error: error.message });
  }
});

// Serve uploaded files
router.get('/uploads/:filename', (req, res) => {
  const filePath = path.join(__dirname, '..', 'uploads', req.params.filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ message: 'File not found' });
  }
});

// Get related posts
router.get('/:slug/related', async (req, res) => {
  try {
    const post = await BlogPost.findOne({ slug: req.params.slug });
    if (!post) {
      return res.status(404).json({ message: 'Blog post not found' });
    }

    const relatedPosts = await BlogPost.find({
      category: post.category,
      slug: { $ne: post.slug },
      isPublished: true
    })
    .sort({ publishedDate: -1 })
    .limit(3)
    .select('title slug description publishedDate readTime category author image tags');

    res.json(relatedPosts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Send blog to subscribers
router.post('/send-to-subscribers/:slug', verifyAdmin, async (req, res) => {
  try {
    const blog = await BlogPost.findOne({ slug: req.params.slug });
    if (!blog) return res.status(404).json({ message: 'Blog not found' });
    await sendBlogToSubscribers(blog);
    res.json({ message: 'Blog sent to all subscribers.' });
  } catch (error) {
    console.error('Error sending blog to subscribers:', error);
    res.status(500).json({ message: 'Failed to send blog to subscribers.' });
  }
});

export default router; 