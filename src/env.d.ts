/**
 * Astro client ambient types for `.astro` pages and islands in this project.
 */
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** Present only after EmDash authenticates an API or OAuth Bearer token. */
    tokenScopes?: string[];
  }
}
