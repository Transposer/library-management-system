const prisma = require("../server/db/prisma");

async function main() {
  const [, , loanId, dueDateInput] = process.argv;

  if (!loanId || !dueDateInput) {
    throw new Error(
      "Usage: node scripts/update-loan-date.js <loanId> <dueDateISO>",
    );
  }

  const dueDate = new Date(dueDateInput);
  if (Number.isNaN(dueDate.getTime())) {
    throw new Error("dueDateISO must be a valid date string");
  }

  const updatedLoan = await prisma.loan.update({
    where: { id: loanId },
    data: {
      dueDate,
    },
    select: {
      id: true,
      dueDate: true,
      status: true,
      returnDate: true,
    },
  });

  console.log(JSON.stringify(updatedLoan, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
