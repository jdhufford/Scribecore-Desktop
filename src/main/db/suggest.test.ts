import { describe, expect, it } from 'vitest'
import { MAX_SUGGESTIONS, extractKeywords, suggestTags } from './suggest'

describe('extractKeywords', () => {
  it('drops stop words and short words, ranks by frequency, ties in first-seen order', () => {
    expect(extractKeywords('The server and the database: database backup for the server, then DNS')).toEqual([
      'server',
      'database',
      'backup',
      'dns',
    ])
  })

  it('handles empty text', () => {
    expect(extractKeywords('')).toEqual([])
  })
})

describe('suggestTags', () => {
  it('puts matching existing tags first, then new keywords', () => {
    expect(suggestTags('Patched servers', 'kernel update on servers', ['ops', 'server', 'kernel'])).toEqual([
      'server',
      'kernel',
      'servers',
      'patched',
      'update',
    ])
  })

  it(`returns at most ${MAX_SUGGESTIONS}`, () => {
    const text = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo'
    expect(suggestTags(text, '', []).length).toBe(MAX_SUGGESTIONS)
  })
})
