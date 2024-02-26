import { clerkClient, currentUser } from "@clerk/nextjs";
import { User } from "@clerk/nextjs/server";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { posts } from "~/server/db/schema";

const filterUserForClient = (user: User) => {
  return {
    id: user.id,
    username: user.username,
    imageUrl: user.imageUrl,
  };
}

export const postRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),

  create: publicProcedure
    .input(z.object({ content: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // simulate a slow db call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const user = await currentUser();

      if (!user) {
        throw new Error("Not authenticated");
      }

      await ctx.db.insert(posts).values({
        content: input.content,
        author: user.id,
      });
    }),

  getLatest: publicProcedure.query(({ ctx }) => {
    return ctx.db.query.posts.findFirst({
      orderBy: (posts, { desc }) => [desc(posts.createdAt)],
    });
  }),

  getAll: publicProcedure.query(async ({ctx}) => {
    const posts = await ctx.db.query.posts.findMany();
    const users = (await clerkClient.users.getUserList({userId: posts.map(p => p.author)})).map(filterUserForClient);
    return posts.map((post) => ({
      post,
      author: users.find((user) => user.id === post.author),
    }));
  }),
});
