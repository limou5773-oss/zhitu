import AdmZip from 'adm-zip'
import path from 'path'
import os from 'os'
import fs from 'fs-extra'
import { generateProjectId } from './gitService.js'

export function extractZip(
  zipBuffer: Buffer,
  originalName: string,
): { projectId: string; projectDir: string; name: string } {
  const projectId = generateProjectId()
  const projectDir = path.join(os.tmpdir(), 'diagram-analyzer', projectId)
  fs.ensureDirSync(projectDir)

  const zip = new AdmZip(zipBuffer)

  // Path traversal guard
  const entries = zip.getEntries()
  for (const entry of entries) {
    if (entry.entryName.includes('..')) {
      throw new Error(`Path traversal detected in ZIP: ${entry.entryName}`)
    }
  }

  zip.extractAllTo(projectDir, true)

  // Handle nested root directory (common in GitHub ZIP downloads)
  const topEntries = fs.readdirSync(projectDir)
  if (topEntries.length === 1) {
    const single = path.join(projectDir, topEntries[0])
    if (fs.statSync(single).isDirectory()) {
      // Flatten: move contents up one level
      const children = fs.readdirSync(single)
      for (const child of children) {
        fs.moveSync(path.join(single, child), path.join(projectDir, child), { overwrite: true })
      }
      fs.removeSync(single)
    }
  }

  const name = originalName.replace(/\.zip$/i, '')

  return { projectId, projectDir, name }
}
