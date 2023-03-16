import fs from 'fs'
import path from 'path'
import { execa } from 'execa'
import express from 'express'
import invariant from 'tiny-invariant'
import { z } from 'zod'

const PORT = 4000

const app = express()

// const url = 'https://www.youtube.com/watch?v=LlN8MPS7KQs'
// const url = 'https://www.youtube.com/watch?v=xR3V5Ow2dTI'
const url = 'https://www.youtube.com/watch?v=YRLw55eGMn8'

app.get('/', async (req, res) => {
  // Get stream link
  const { stdout: result } = await execa('yt-dlp', ['-j', url])
  const json = JSON.parse(result)
  const validated = await z
    .object({
      duration: z.number(),
      formats: z.array(
        z.object({
          acodec: z.string(),
          audio_ext: z.string(),
          url: z.string(),
          quality: z.number().optional(),
          filesize: z.number().nullish(),
          abr: z.number().optional(),
        }),
      ),
    })
    .parseAsync(json)

  const format = validated.formats
    .sort((prev, next) => prev.quality ?? 0 - (next.quality ?? 0))
    .find(f => f.acodec === 'opus' && f.audio_ext === 'webm')
  invariant(format, 'suitable audio format not found')
  invariant(format.filesize, 'audio format should have filesize')
  invariant(format.abr, 'audio format should have bitrate')

  // const location = path.resolve('snow.weba')
  // const stats = await fs.promises.stat(location)

  // res.writeHead(200, {
  //   'content-type': 'audio/webm',
  //   'content-length': stats.size,
  //   'transfer-encoding': 'chunked',
  // })

  // const stream = fs.createReadStream(location)
  // stream.pipe(res)

  // prettier-ignore
  const { stdout, stderr } = execa('ffmpeg', [
    '-i',
    format.url,
    // '-re', // Read at native frame rate
    '-vn', // Disable video processing
    '-c:a', 'libopus', // Set audio codec
    // '-b:a', `${format.abr * 1_000}`,
    '-f', 'webm', // Set output format
    '-ss', "0", // Start time in seconds
    '-to', validated.duration.toString(), // End time in seconds
    '-', // Send output to stdout
  ])
  invariant(stdout, 'ffmpeg stdout should be available')
  invariant(stderr, 'ffmpeg stderr should be available')
  stderr.pipe(process.stderr)

  res.writeHead(200, {
    'content-type': 'audio/webm',
    'transfer-encoding': 'chunked',
    // 'content-length': format.filesize,
    'accept-ranges': 'bytes',
  })

  stdout.pipe(res)
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Listening on port ${PORT}`)
})
