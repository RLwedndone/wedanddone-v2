// src/pages/BlogPostRoute.tsx
import React from "react";
import { useParams } from "react-router-dom";
import { blogPosts } from "../data/blogPosts";
import BlogPost from "./BlogPost";
import BlogPostV2 from "./BlogPostV2";

const BlogPostRoute: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = blogPosts.find((p) => p.slug === slug);

  // Default old posts to v1
  const renderer = post?.renderer ?? "v1";

  return renderer === "v2" ? <BlogPostV2 /> : <BlogPost />;
};

export default BlogPostRoute;