/**
 * Square credential diagnostics — public, deliberately minimal.
 *
 * Why this exists: the deployed checkout could not initialise the card form.
 * `pci-connect.squareup.com/payments/hydrate` returned 401 for EVERY hostname
 * (web.app, the custom domain, localhost, example.com), so it is not a domain
 * allowlist problem — it is the applicationId/locationId pair. The browser
 * cannot tell us why, and the access token lives only on the server.
 *
 * This endpoint answers the one question that splits the diagnosis: does the
 * server's production token see the location the client build is using?
 *
 * IMPORTANT — load the Square SDK lazily. Importing it at module scope costs
 * ~8 seconds, and the Firebase CLI's deploy analyzer gives the whole codebase
 * 10 seconds to load before it fails with "User code failed to load". index.ts
 * already pays that cost once; a second module paying it again broke deploys.
 *
 * It returns booleans, a count, and ONE location id (location ids are already
 * public — they are inlined into the storefront bundle). No merchant data, no
 * tokens, no prices.
 */
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { defineString } from "firebase-functions/params";

const squareAccessToken = defineString("SQUARE_ACCESS_TOKEN");
const squareEnvironment = defineString("SQUARE_ENVIRONMENT", { default: "sandbox" });

export const squareDiagnostics = onRequest(
  { cors: true, region: "us-central1" },
  async (req, res) => {
    const asked = typeof req.query.locationId === "string" ? req.query.locationId : "";
    const base = {
      environment: squareEnvironment.value(),
      tokenConfigured: !!squareAccessToken.value(),
    };

    try {
      const { SquareClient, SquareEnvironment } = await import("square");
      const environment =
        squareEnvironment.value().trim().toLowerCase() === "production"
          ? SquareEnvironment.Production
          : SquareEnvironment.Sandbox;

      const client = new SquareClient({
        token: squareAccessToken.value(),
        environment,
      });
      const list = await client.locations.list();
      const ids = (list.locations ?? [])
        .map((l) => l.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0);

      res.json({
        ...base,
        locationsReachable: true,
        locationCount: ids.length,
        // undefined when the caller did not ask; otherwise the whole point.
        requestedLocationMatches: asked ? ids.includes(asked) : undefined,
        // The first id on the account — public by design (client config).
        firstLocationId: ids[0],
      });
    } catch (err) {
      logger.warn("squareDiagnostics: locations.list failed", err);
      res.json({
        ...base,
        locationsReachable: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
);
