import { ContactDetailPanel } from "../../../../features/conversion/audience-panel";
export default async function ContactPage({ params }: { params: Promise<{ contactId: string }> }) { const { contactId } = await params; return <ContactDetailPanel id={contactId} />; }
