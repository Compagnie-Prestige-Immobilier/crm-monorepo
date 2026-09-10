import type { ComponentProps } from 'react';

type Props = Omit<ComponentProps<'img'>, 'src'> & {
  src: string | { src: string };
  priority?: boolean | undefined;
  fill?: boolean | undefined;
  quality?: number | undefined;
  unoptimized?: boolean | undefined;
  placeholder?: string | undefined;
};

export default function Image({
  src,
  priority,
  fill,
  quality: _quality,
  unoptimized: _unoptimized,
  placeholder: _placeholder,
  alt,
  className,
  style,
  ...rest
}: Props) {
  return (
    <img
      src={typeof src === 'string' ? src : src.src}
      alt={alt ?? ''}
      loading={priority === true ? 'eager' : 'lazy'}
      className={className}
      style={
        fill === true ? { ...style, position: 'absolute', inset: 0, objectFit: 'cover' } : style
      }
      {...rest}
    />
  );
}
