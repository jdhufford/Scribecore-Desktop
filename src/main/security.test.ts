import { describe, expect, it } from 'vitest'
import { isAllowedExternalUrl, isAllowedRequest } from './security'

describe('isAllowedExternalUrl', () => {
  it.each([
    'https://github.com/jdhufford/Scribecore-Desktop',
    'https://github.com/jdhufford/Scribecore-Desktop/releases',
    'https://github.com/jdhufford/scribecore-desktop/issues/1',
  ])('allows %s', (url) => {
    expect(isAllowedExternalUrl(url)).toBe(true)
  })

  it.each([
    'http://github.com/jdhufford/Scribecore-Desktop',
    'https://github.com/jdhufford/Scribecore-Desktop-evil',
    'https://github.com/someone-else/Scribecore-Desktop',
    'https://github.com.evil.example/jdhufford/Scribecore-Desktop',
    'https://user@github.com/jdhufford/Scribecore-Desktop',
    'https://github.com:8443/jdhufford/Scribecore-Desktop',
    'file:///C:/Windows/System32/calc.exe',
    'javascript:alert(1)',
    'not a url',
  ])('blocks %s', (url) => {
    expect(isAllowedExternalUrl(url)).toBe(false)
  })
})

describe('isAllowedRequest', () => {
  it('allows bundled files', () => {
    expect(isAllowedRequest('file:///C:/app/resources/app.asar/out/renderer/index.html')).toBe(true)
  })

  it('blocks the internet in production', () => {
    expect(isAllowedRequest('https://example.com/')).toBe(false)
    expect(isAllowedRequest('http://localhost:5173/')).toBe(false)
  })

  it('allows only the dev server in development', () => {
    const dev = 'http://localhost:5173'
    expect(isAllowedRequest('http://localhost:5173/src/main.ts', dev)).toBe(true)
    expect(isAllowedRequest('ws://localhost:5173/', dev)).toBe(true)
    expect(isAllowedRequest('http://localhost:8080/', dev)).toBe(false)
    expect(isAllowedRequest('https://example.com/', dev)).toBe(false)
  })
})
