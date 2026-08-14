/** Default per-tag style objects for the React Native preset — mirrors `styles.css`'s
 * web defaults (heading scale, link color/underline, code/blockquote treatment, list
 * spacing) so RN output looks like the web default instead of unstyled plain text. */
export const defaultReactNativeStyles: Record<string, Record<string, unknown>> = {
  p: { marginBottom: 12, lineHeight: 22 },
  h1: { fontSize: 28, fontWeight: "700", marginTop: 20, marginBottom: 10 },
  h2: { fontSize: 24, fontWeight: "700", marginTop: 18, marginBottom: 8 },
  h3: { fontSize: 20, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  h4: { fontSize: 18, fontWeight: "600", marginTop: 14, marginBottom: 6 },
  h5: { fontSize: 16, fontWeight: "600", marginTop: 12, marginBottom: 6 },
  h6: { fontSize: 14, fontWeight: "600", marginTop: 12, marginBottom: 6 },
  strong: { fontWeight: "700" },
  em: { fontStyle: "italic" },
  del: { textDecorationLine: "line-through" },
  code: {
    fontFamily: "Courier",
    backgroundColor: "#f2f2f2",
    paddingHorizontal: 4,
    borderRadius: 3,
  },
  pre: {
    fontFamily: "Courier",
    backgroundColor: "#f2f2f2",
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: "#d0d0d0",
    paddingLeft: 12,
    marginBottom: 12,
    opacity: 0.85,
  },
  li: { marginBottom: 4 },
  ul: { marginBottom: 12 },
  ol: { marginBottom: 12 },
  hr: { borderBottomWidth: 1, borderBottomColor: "#d0d0d0", marginVertical: 16 },
  table: { borderWidth: 1, borderColor: "#d0d0d0", marginBottom: 12 },
  // RN has no native table layout — `tr` lays cells out as a row (flex), `th`/`td` split
  // the row evenly; only a bottom rule separates rows (no per-cell borders, unlike web).
  tr: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#d0d0d0" },
  th: { flex: 1, fontWeight: "700", padding: 6 },
  td: { flex: 1, padding: 6 },
  a: { color: "#2563eb", textDecorationLine: "underline" },
};
