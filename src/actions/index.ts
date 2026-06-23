import { createMikaActions } from "./mika";
import { mikaApiOverrides } from "../lib/mika-api";

export const server = {
  mika: createMikaActions({ api: mikaApiOverrides }),
};
