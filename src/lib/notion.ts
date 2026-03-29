import { Client } from "@notionhq/client";

interface TransactionForSync {
  id: string;
  date: Date;
  amount: { toString(): string };
  category: string;
  type: string;
  note: string;
  source: string;
}

function getNotionClient(): Client {
  return new Client({
    auth: process.env.NOTION_TOKEN,
  });
}

export function syncTransactionToNotion(transaction: TransactionForSync): void {
  const notion = getNotionClient();
  const databaseId = process.env.NOTION_TRANSACTIONS_DB_ID;

  const title = transaction.note.trim() !== "" ? transaction.note : transaction.category;
  const dateStr = transaction.date.toISOString().split("T")[0];
  const amount = parseFloat(transaction.amount.toString());

  notion.pages
    .create({
      parent: { database_id: databaseId! },
      properties: {
        名稱: {
          title: [
            {
              text: {
                content: title,
              },
            },
          ],
        },
        金額: {
          number: amount,
        },
        類型: {
          select: {
            name: transaction.type,
          },
        },
        分類: {
          select: {
            name: transaction.category,
          },
        },
        日期: {
          date: {
            start: dateStr,
          },
        },
        來源: {
          select: {
            name: transaction.source,
          },
        },
      },
    })
    .then(async (page) => {
      // Update the notionPageId in the database
      try {
        const { prisma } = await import("./db");
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { notionPageId: page.id },
        });
      } catch (updateError) {
        console.error("Failed to update notionPageId:", updateError);
      }
    })
    .catch((error: unknown) => {
      console.error("syncTransactionToNotion error:", error);
    });
}
