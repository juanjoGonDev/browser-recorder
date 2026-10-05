import { BUNDLED_EPHEMERAL } from '../../shared/domain/browser-choice.ts';
import type { Recording } from '../../shared/domain/recording.ts';
import { allocateSlug } from '../domain/allocate-slug.ts';
import { parseRecording } from '../domain/parse-recording.ts';
import { slugify } from '../domain/slugify.ts';
import { summarizeRecording } from '../domain/summarize-recording.ts';
import { validateName } from '../domain/validate-name.ts';
import { validateStartUrl } from '../domain/validate-start-url.ts';
import { createKeyedSerializer } from './keyed-serializer.ts';
import type {
  RecordingListing,
  RecordingRepository,
} from './ports/recording-repository.ts';

export interface LibraryServiceDeps {
  readonly repository: RecordingRepository;
  readonly renderScript: (recording: Recording) => string;
  readonly now: () => Date;
}

export interface LibraryService {
  createDraft(name: string, startUrl: string | null): Promise<Recording>;
  /** Newest first; a corrupt entry is listed as `invalid`, never thrown. */
  list(): Promise<readonly RecordingListing[]>;
  load(slug: string): Promise<Recording>;
  /** Writes `recording.json` and the regenerated `script.mjs` atomically. */
  save(recording: Recording): Promise<void>;
  /** Rewrites `script.mjs` from `recording.json`; the recording is untouched. */
  regenerateScript(slug: string): Promise<Recording>;
  rename(slug: string, name: string): Promise<Recording>;
  remove(slug: string): Promise<void>;
}

const DEFAULT_DISPLAY: Recording['display'] = {
  kind: 'window',
  width: 1280,
  height: 800,
};

const JSON_INDENT = 2;

function assertValid(message: string | null): void {
  if (message !== null) throw new Error(message);
}

function describeFailure(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function byNewestFirst(a: RecordingListing, b: RecordingListing): number {
  const createdA = a.kind === 'valid' ? a.summary.createdAt : '';
  const createdB = b.kind === 'valid' ? b.summary.createdAt : '';
  return createdB.localeCompare(createdA);
}

export function createLibraryService(deps: LibraryServiceDeps): LibraryService {
  return new RepositoryLibraryService(deps);
}

class RepositoryLibraryService implements LibraryService {
  private readonly deps: LibraryServiceDeps;
  private readonly serializer = createKeyedSerializer();

  constructor(deps: LibraryServiceDeps) {
    this.deps = deps;
  }

  async createDraft(name: string, startUrl: string | null): Promise<Recording> {
    const trimmedUrl = (startUrl ?? '').trim();
    assertValid(validateName(name));
    assertValid(validateStartUrl(trimmedUrl));
    const slug = await this.reserveSlug(name);
    const createdAt = this.deps.now().toISOString();
    const draft: Recording = {
      schemaVersion: 2,
      name,
      slug,
      startUrl: trimmedUrl === '' ? null : trimmedUrl,
      createdAt,
      updatedAt: createdAt,
      status: 'recording',
      durationMs: 0,
      display: DEFAULT_DISPLAY,
      browser: BUNDLED_EPHEMERAL,
      events: [],
    };
    await this.serializer.run(slug, () => this.writeFiles(draft));
    return draft;
  }

  async list(): Promise<readonly RecordingListing[]> {
    const slugs = await this.deps.repository.listSlugs();
    const entries = await Promise.all(
      slugs.map((slug) => this.listEntry(slug)),
    );
    return entries.sort(byNewestFirst);
  }

  async load(slug: string): Promise<Recording> {
    return parseRecording(await this.deps.repository.read(slug));
  }

  save(recording: Recording): Promise<void> {
    return this.serializer.run(recording.slug, () =>
      this.writeFiles(recording),
    );
  }

  async regenerateScript(slug: string): Promise<Recording> {
    return await this.serializer.run(slug, async () => {
      const recording = await this.load(slug);
      await this.deps.repository.writeScript(
        slug,
        this.deps.renderScript(recording),
      );
      return recording;
    });
  }

  async rename(slug: string, name: string): Promise<Recording> {
    assertValid(validateName(name));
    return await this.serializer.run(slug, () => this.renameLocked(slug, name));
  }

  remove(slug: string): Promise<void> {
    return this.serializer.run(slug, () => this.deps.repository.remove(slug));
  }

  private async writeFiles(recording: Recording): Promise<void> {
    const stamped = { ...recording, updatedAt: this.deps.now().toISOString() };
    await this.deps.repository.write(recording.slug, {
      recordingJson: `${JSON.stringify(stamped, null, JSON_INDENT)}\n`,
      scriptMjs: this.deps.renderScript(stamped),
    });
  }

  private async reserveSlug(name: string): Promise<string> {
    const { repository } = this.deps;
    const taken = new Set(await repository.listSlugs());
    const base = slugify(name);
    for (;;) {
      const slug = allocateSlug(base, taken);
      if (await repository.reserve(slug)) return slug;
      taken.add(slug);
    }
  }

  private async listEntry(slug: string): Promise<RecordingListing> {
    try {
      const summary = summarizeRecording(await this.load(slug));
      return { kind: 'valid', summary: { ...summary, slug } };
    } catch (error) {
      return { kind: 'invalid', slug, reason: describeFailure(error) };
    }
  }

  private async renameLocked(slug: string, name: string): Promise<Recording> {
    const { repository } = this.deps;
    const recording = await this.load(slug);
    const newSlug = slugify(name);
    if (newSlug === slug) return this.rewrite(recording, name, slug);
    if ((await repository.listSlugs()).includes(newSlug)) {
      throw new Error(`A recording named "${name}" already exists.`);
    }
    await repository.move(slug, newSlug);
    try {
      return await this.rewrite(recording, name, newSlug);
    } catch (error) {
      await repository.move(newSlug, slug).catch(() => undefined);
      throw error;
    }
  }

  private async rewrite(
    recording: Recording,
    name: string,
    slug: string,
  ): Promise<Recording> {
    const next = { ...recording, name, slug };
    await this.writeFiles(next);
    return next;
  }
}
