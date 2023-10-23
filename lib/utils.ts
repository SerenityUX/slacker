import fs from "fs";
import { Config } from "./types";
import yaml from "js-yaml";
import { slack } from "..";
import prisma from "./db";

export const joinChannels = async () => {
  const files = fs.readdirSync("./config");

  files.forEach(async (file) => {
    try {
      const config = yaml.load(fs.readFileSync(`./config/${file}`, "utf-8")) as Config;
      const channels = config["slack-channels"];

      for (let i = 0; i < channels.length; i++) {
        const channel = channels[i];

        const c = await prisma.channel.upsert({
          where: { slackId: channel.id },
          update: { name: channel.name },
          create: { name: channel.name, slackId: channel.id },
        });

        await slack.client.conversations.join({ channel: channel.id });
      }
    } catch (err) {
      console.error(err);
    }
  });
};

export const getMaintainers = async ({
  channelId,
  repoUrl,
}: {
  channelId?: string;
  repoUrl?: string;
}) => {
  const files = fs.readdirSync("./config");
  const maintainers: string[] = [];

  files.forEach(async (file) => {
    try {
      const config = yaml.load(fs.readFileSync(`./config/${file}`, "utf-8")) as Config;
      const maintainers = config["maintainers"];
      const channels = config["slack-channels"];
      const repos = config["repos"];

      if (
        (channelId && channels.some((channel) => channel.id === channelId)) ||
        (repos && repos.some((repo) => repo.uri === repoUrl))
      )
        maintainers.push(...maintainers);
    } catch (err) {}
  });

  return maintainers;
};

export const syncParticipants = async (participants: string[], id: number) => {
  for (let i = 0; i < participants.length; i++) {
    const userInfo = await slack.client.users.info({ user: participants[i] as string });

    await prisma.participant.create({
      data: {
        actionItem: { connect: { id } },
        user: {
          connectOrCreate: {
            where: { slackId: participants[i] as string, email: userInfo.user?.profile?.email },
            create: { slackId: participants[i] as string, email: userInfo.user?.profile?.email || "" },
          },
        },
      },
    });
  }
};