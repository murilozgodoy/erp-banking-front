import { Link, type LinkProps } from 'react-router'

import { buttonClass, type ButtonVariant } from './buttonStyles'

/** Link de navegação com aparência de botão. */
export function ButtonLink({
  variant = 'primary',
  className = '',
  ...props
}: LinkProps & { variant?: ButtonVariant }) {
  return <Link className={buttonClass(variant, className)} {...props} />
}
