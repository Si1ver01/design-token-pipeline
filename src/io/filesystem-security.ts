import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readSync,
  realpathSync,
  type Stats,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';

export interface FileIdentity {
  readonly dev: number;
  readonly ino: number;
}

export interface DirectorySnapshot {
  readonly path: string;
  readonly realPath: string;
  readonly identity: FileIdentity;
}

export function identityOf(stats: Stats): FileIdentity {
  return Object.freeze({ dev: stats.dev, ino: stats.ino });
}

export function sameIdentity(left: FileIdentity, right: FileIdentity): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

export function snapshotDirectory(path: string): DirectorySnapshot {
  const stats = lstatSync(path);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error('Expected a real directory and got a symbolic link or non-directory.');
  }
  return Object.freeze({
    path,
    realPath: realpathSync(path),
    identity: identityOf(stats),
  });
}

export function snapshotTrustedDirectory(path: string, label: string): DirectorySnapshot {
  const snapshot = snapshotDirectory(path);
  assertTrustedDirectorySnapshot(snapshot, label);
  return snapshot;
}

export function snapshotTrustedDirectoryChain(
  rootDirectory: string,
  targetDirectory: string,
  label: string,
): readonly DirectorySnapshot[] {
  const root = resolve(rootDirectory);
  const target = resolve(targetDirectory);
  const relativeTarget = relative(root, target);
  if (
    relativeTarget === '..' ||
    relativeTarget.startsWith('../') ||
    relativeTarget.startsWith('..\\')
  ) {
    throw new Error(`${label} must remain inside the configured root directory.`);
  }
  const paths = [root];
  if (relativeTarget !== '') {
    let current = root;
    for (const segment of relativeTarget.split(/[\\/]/u)) {
      current = join(current, segment);
      paths.push(current);
    }
  }
  return Object.freeze(paths.map((path) => snapshotTrustedDirectory(path, label)));
}

export function ensureTrustedDirectoryChain(
  rootDirectory: string,
  targetDirectory: string,
  label: string,
): readonly DirectorySnapshot[] {
  const root = resolve(rootDirectory);
  const target = resolve(targetDirectory);
  const relativeTarget = relative(root, target);
  if (
    relativeTarget === '..' ||
    relativeTarget.startsWith('../') ||
    relativeTarget.startsWith('..\\')
  ) {
    throw new Error(`${label} must remain inside the configured root directory.`);
  }
  const snapshots: DirectorySnapshot[] = [snapshotTrustedDirectory(root, label)];
  let current = root;
  for (const segment of relativeTarget === '' ? [] : relativeTarget.split(/[\\/]/u)) {
    current = join(current, segment);
    try {
      snapshots.push(snapshotTrustedDirectory(current, label));
    } catch (error) {
      if (!(error instanceof Error) || !isMissingPathError(error)) throw error;
      mkdirSync(current, { mode: 0o700 });
      snapshots.push(snapshotTrustedDirectory(current, label));
    }
  }
  return Object.freeze(snapshots);
}

export function assertDirectorySnapshot(snapshot: DirectorySnapshot): void {
  const stats = lstatSync(snapshot.path);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error('Directory changed to a symbolic link or non-directory.');
  }
  if (!sameIdentity(identityOf(stats), snapshot.identity)) {
    throw new Error('Directory identity changed while the operation was in progress.');
  }
  if (realpathSync(snapshot.path) !== snapshot.realPath) {
    throw new Error('Directory real path changed while the operation was in progress.');
  }
}

export function assertTrustedDirectorySnapshot(snapshot: DirectorySnapshot, label: string): void {
  assertDirectorySnapshot(snapshot);
  const stats = lstatSync(snapshot.path);
  if (!sameIdentity(identityOf(stats), snapshot.identity)) {
    throw new Error(`${label} identity changed while trust was being established.`);
  }
  if (process.platform === 'win32') return;
  if ((stats.mode & 0o022) !== 0) {
    throw new Error(`${label} must not be group- or world-writable.`);
  }
  const effectiveUserId = process.geteuid?.();
  if (
    effectiveUserId !== undefined &&
    effectiveUserId !== 0 &&
    stats.uid !== 0 &&
    stats.uid !== effectiveUserId
  ) {
    throw new Error(`${label} must be owned by the current user or root.`);
  }
}

export function assertTrustedDirectoryChain(
  snapshots: readonly DirectorySnapshot[],
  label: string,
): void {
  for (const snapshot of snapshots) assertTrustedDirectorySnapshot(snapshot, label);
}

export function assertRegularFile(path: string, label: string): Stats {
  const stats = lstatSync(path);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error(`${label} must be a regular file and cannot be a symbolic link.`);
  }
  return stats;
}

export function assertOpenedFileIdentity(
  path: string,
  before: Stats,
  opened: Stats,
  label: string,
): void {
  const after = assertRegularFile(path, label);
  if (
    !sameIdentity(identityOf(before), identityOf(after)) ||
    !sameIdentity(identityOf(after), identityOf(opened))
  ) {
    throw new Error(`${label} changed while it was being opened.`);
  }
}

export function noFollowReadFlags(): number {
  return constants.O_NOFOLLOW ?? 0;
}

export function readRegularFileByDescriptor(
  path: string,
  label: string,
  maxBytes: number,
): { readonly stats: Stats; readonly content: string } {
  const before = assertRegularFile(path, label);
  const descriptor = openSync(path, constants.O_RDONLY | noFollowReadFlags());
  try {
    const opened = fstatSync(descriptor);
    if (!opened.isFile() || opened.isSymbolicLink()) {
      throw new Error(`${label} is not a regular file.`);
    }
    assertOpenedFileIdentity(path, before, opened, label);
    if (opened.size > maxBytes) {
      throw new Error(`${label} exceeds the configured size limit.`);
    }
    const { buffer, bytesRead } = readDescriptorBounded(descriptor, maxBytes);
    if (bytesRead > maxBytes) {
      throw new Error(`${label} exceeds the configured size limit.`);
    }
    return Object.freeze({
      stats: opened,
      content: buffer.subarray(0, bytesRead).toString('utf8'),
    });
  } finally {
    closeSync(descriptor);
  }
}

export function regularFileMatchesContent(path: string, label: string, expected: string): boolean {
  const before = assertRegularFile(path, label);
  const expectedBytes = Buffer.from(expected, 'utf8');
  const descriptor = openSync(path, constants.O_RDONLY | noFollowReadFlags());
  try {
    const opened = fstatSync(descriptor);
    if (!opened.isFile() || opened.isSymbolicLink()) {
      throw new Error(`${label} is not a regular file.`);
    }
    assertOpenedFileIdentity(path, before, opened, label);
    if (opened.size !== expectedBytes.byteLength) return false;
    const { buffer, bytesRead } = readDescriptorBounded(descriptor, expectedBytes.byteLength);
    return (
      bytesRead === expectedBytes.byteLength && buffer.subarray(0, bytesRead).equals(expectedBytes)
    );
  } finally {
    closeSync(descriptor);
  }
}

function readDescriptorBounded(
  descriptor: number,
  maxBytes: number,
): { readonly buffer: Buffer; readonly bytesRead: number } {
  const buffer = Buffer.allocUnsafe(maxBytes + 1);
  let bytesRead = 0;
  while (bytesRead < buffer.length) {
    const count = readSync(descriptor, buffer, bytesRead, buffer.length - bytesRead, null);
    if (count === 0) break;
    bytesRead += count;
  }
  return { buffer, bytesRead };
}

function isMissingPathError(error: Error): boolean {
  return 'code' in error && error.code === 'ENOENT';
}

export function assertPathInsideRoot(
  rootDirectory: string,
  filePath: string,
  label: string,
): string {
  const root = realpathSync(resolve(rootDirectory));
  const realFile = realpathSync(filePath);
  const realRelative = relative(root, realFile);
  if (realRelative === '..' || realRelative.startsWith('../') || realRelative.startsWith('..\\')) {
    throw new Error(`${label} resolves outside the configured root directory.`);
  }
  return realFile;
}
