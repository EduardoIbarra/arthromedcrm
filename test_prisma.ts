import prisma from './src/lib/prisma'

async function main() {
  try {
    const ticket = await prisma.tickets.create({
      data: {
        title: "Test Ticket",
        description: "Testing from script",
        reporter_id: "5268a36c-dff6-4330-a312-401dbce422e1",
        assignee: "",
        status: "open"
      }
    })
    console.log("Success!", ticket)
  } catch (err: any) {
    console.error("Prisma Error:", err.message)
  }
}

main()
