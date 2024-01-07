import { getUnchainedDbClient } from "$lib/unchained/db";
import { json } from "@sveltejs/kit";

const cache = new Map();
let currentSprint;

/** @type {import('@sveltejs/kit').RequestHandler} */
export async function GET() {
  const prisma = getUnchainedDbClient();
  const sprint = Math.ceil(new Date().valueOf() / 300000);

  const signers =
    sprint === currentSprint
      ? cache.get("signers")
      : await prisma.signer.findMany({
          select: { id: true, name: true, key: true, points: true },
        });

  cache.set("signers", signers);

  const datapoints =
    cache.get("datapoints") || (await prisma.assetPrice.count());
  cache.set("datapoints", datapoints);

  const validations =
    cache.get("validations") || (await prisma.signersOnAssetPrice.count());
  cache.set("validations", validations);

  const twoDaysAgo = 2 * 7200;

  const prices =
    sprint === currentSprint
      ? cache.get("prices")
      : await prisma.assetPrice.findMany({
          orderBy: [{ block: "desc" }],
          take: twoDaysAgo,
          select: {
            price: true,
            block: true,
            _count: {
              select: { signersOnAssetPrice: true },
            },
          },
        });

  cache.set("prices", prices);

  currentSprint = sprint;

  return json({
    signers,
    prices: prices.map((price) => ({
      price: price.price,
      block: price.block,
      signers: price._count.signersOnAssetPrice,
    })),
    stats: {
      datapoints,
      validations,
    },
  });
}
