type JsonLdProps = {
  data: object;
};

/** Server-rendered JSON-LD. Escapes `<` per Next.js structured-data guidance. */
export function JsonLd({ data }: JsonLdProps) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
