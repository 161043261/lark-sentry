export function scanPageFiles(pagesDir: string[]): string;

export function toRoutePath(pagesDir: string, file: string): string;

export function toComponentName(routePath: string): string

export function generateRoutes(pagesDir: string, outputFile: string): void;
