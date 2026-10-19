import { ApiError, buildQuery, request } from './http'

describe('http client', () => {
  afterEach(() => vi.restoreAllMocks())

  it('builds query strings skipping empty values', () => {
    expect(buildQuery({ a: 1, b: '', c: undefined, d: 'x y' })).toBe('?a=1&d=x+y')
    expect(buildQuery({})).toBe('')
  })

  it('maps API validation errors to ApiError with field messages', async () => {
    document.cookie = 'csrftoken=abc'
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Please correct the highlighted fields.', errors: { slug: ['Taken.'] } }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const err = (await request('POST', '/api/projects/', { name: 'x' }).catch((e: unknown) => e)) as ApiError
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(400)
    expect(err.field('slug')).toBe('Taken.')
    const [, init] = fetchMock.mock.calls.at(-1)!
    expect((init!.headers as Record<string, string>)['X-CSRFToken']).toBe('abc')
  })

  it('reports network failures clearly', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(request('GET', '/api/projects/')).rejects.toMatchObject({ status: 0, message: expect.stringMatching(/Cannot reach the server/) })
  })

  it('uses friendly fallback messages', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('oops', { status: 500 }))
    await expect(request('GET', '/x')).rejects.toMatchObject({ message: expect.stringMatching(/server encountered an error/) })
  })
})
