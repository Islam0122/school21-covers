import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import SignInPage from './sign-in'

describe('sign in page', () => {
  it('validates fields before calling the API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>,
    )
    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByText('Password is required.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
