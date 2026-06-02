import simpleGit from 'simple-git'
import path from 'path'
import os from 'os'
import fs from 'fs-extra'

let counter = 0

export function generateProjectId(): string {
  const now = new Date()
  const ts = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_')
  counter++
  return `p_${ts}_${counter.toString(36)}`
}

export async function cloneRepo(
  repoUrl: string,
  branch: string,
  token?: string,
): Promise<{ projectId: string; projectDir: string; name: string }> {
  const projectId = generateProjectId()
  const projectDir = path.join(os.tmpdir(), 'diagram-analyzer', projectId)

  fs.ensureDirSync(projectDir)

  let url = repoUrl
  if (token) {
    // Inject token for private repos
    const u = new URL(repoUrl)
    u.username = token
    url = u.toString()
  }

  const git = simpleGit()
  await git.clone(url, projectDir, ['--branch', branch, '--single-branch', '--depth', '50'])

  const name = path.basename(repoUrl, '.git') || repoUrl.split('/').pop() || 'repo'

  return { projectId, projectDir, name }
}
