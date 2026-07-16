/**
 * Container Component
 *
 * Responsive container with max-width and padding control.
 * Centers content and provides consistent spacing.
 *
 * @example
 * <Container size="lg">
 *   <h1>Welcome</h1>
 *   <p>Content goes here</p>
 * </Container>
 *
 * <Container size="full" padding={false} as="section">
 *   Full-width content without padding
 * </Container>
 */

import React from 'react'
import styles from './Container.module.css'

type ContainerElement = 'div' | 'section' | 'article' | 'main'

type ContainerOwnProps<E extends ContainerElement = 'div'> = {
  /** Maximum width of container */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  /** Add responsive padding */
  padding?: boolean
  /** Center the container horizontally */
  centered?: boolean
  /** Content to render */
  children: React.ReactNode
  /** HTML element to render as */
  as?: E
  /** Additional CSS class */
  className?: string
  /** Inline styles */
  style?: React.CSSProperties
}

export type ContainerProps<E extends ContainerElement = 'div'> = ContainerOwnProps<E> &
  Omit<React.ComponentPropsWithoutRef<E>, keyof ContainerOwnProps<E>>

type PolymorphicRef<E extends React.ElementType> = React.ComponentPropsWithRef<E>['ref']

type PolymorphicContainer = <E extends ContainerElement = 'div'>(
  props: ContainerProps<E> & { ref?: PolymorphicRef<E> }
) => React.ReactElement | null

export const Container: PolymorphicContainer = React.forwardRef(
  <E extends ContainerElement = 'div'>(
    {
      size = 'lg',
      padding = true,
      centered = true,
      children,
      as,
      className = '',
      style,
      ...rest
    }: ContainerProps<E>,
    ref: PolymorphicRef<E>
  ) => {
    const Component = (as || 'div') as React.ElementType

    const containerClasses = [
      styles.container,
      styles[size],
      padding ? styles.padding : '',
      centered ? styles.centered : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <Component ref={ref} className={containerClasses} style={style} {...rest}>
        {children}
      </Component>
    )
  }
) as PolymorphicContainer
;(Container as { displayName?: string }).displayName = 'Container'
