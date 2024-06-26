import { getUnchainedDbClient } from "$lib/unchained/db";
import { json } from "@sveltejs/kit";
import { calculateAddress } from "$lib/base32";

const count = async (prisma, table) => {
  const [{ estimate }] = await prisma.$queryRaw`
      SELECT reltuples AS estimate
        FROM pg_class
        WHERE oid = ${table}::regclass;`;
  return estimate;
};

const encode = (input) => {
  if (!input) {
    return "N/A";
  }
  return calculateAddress(input);
};

const getSigners = async (prisma) => {
  const rawSigners = await prisma.signers.findMany({
    select: { id: true, name: true, key: true, points: true },
  });

  const signers = rawSigners.map((signer) => ({
    ...signer,
    key: encode(signer.key),
  }));

  return signers;
};

/** @type {import('@sveltejs/kit').RequestHandler} */
export async function GET() {
  const prisma = getUnchainedDbClient();

  const signers = await getSigners(prisma);

  const datapoints =
    (await count(prisma, '"AssetPrice"')) +
    (await count(prisma, '"asset_prices"'));

  const validations =
    (await count(prisma, '"SignersOnAssetPrice"')) +
    (await count(prisma, '"asset_price_signers"'));

  const lastTwentyFourHours = 2400;

  const prices = await prisma.asset_prices.findMany({
    orderBy: [{ block: "desc" }],
    take: lastTwentyFourHours,
    select: {
      price: true,
      block: true,
      signers_count: true,
      asset: true,
    },
    where: { consensus: true, NOT: { asset: null } },
  });

  return json({
    signers,
    prices,
    stats: { datapoints, validations },
  });
}
