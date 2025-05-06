// // CREATE COPY
// const data = {
//   position: cvThequeCritere.position,
//   domain: cvThequeCritere.domain,
//   description: cvThequeCritere.description,
//   diplome: cvThequeCritere.diplome,
//   localisation: cvThequeCritere.localisation,
//   distance: cvThequeCritere.distance,
//   experience: cvThequeCritere.experience,
//   ...modifiedFields,
//   evaluation: cvThequeCritere.evaluation,
//   userId: cvThequeCritere.userId,
// };

// const newCvThequeCritere = await prisma.cvThequeCritere.create({ data });
// updatedCvThequeCritereId = newCvThequeCritere.id;

// // COPY CVTHEQUE COMPETENCES
// if (body.competences && body.competences.length > 0) {
//   const trimmedCompetences = body.competences
//     .map((c) => c.trim())
//     .filter((c) => c.length > 0);

//   for (const item of trimmedCompetences) {
//     await prisma.cvThequeCompetence.create({
//       data: {
//         content: item,
//         cvThequeCritereId: newCvThequeCritere.id,
//       },
//     });
//   }
// }

// // COPY CVTHEUQUE USERS
// for (const item of cvThequeCritere.cvThequeUsers) {
//   await prisma.cvThequeUser.create({
//     data: {
//       score: item.score,
//       userId: item.userId,
//       cvThequeCritereId: newCvThequeCritere.id,
//     },
//   });
// }

// // COPY CVTHEUQUE VIEWS
// for (const item of cvThequeCritere.cvThequeViews) {
//   await prisma.cvThequeView.create({
//     data: {
//       count: item.count,
//       cvMinuteId: item.cvMinuteId,
//       cvThequeCritereId: newCvThequeCritere.id,
//     },
//   });
// }

// // COPY CVMINUTES
// for (const item of cvThequeCritere.cvMinutes) {
//   const newCvMinute = await prisma.cvMinute.create({
//     data: {
//       position: item.position,
//       name: item.name,
//       primaryBg: item.primaryBg,
//       secondaryBg: item.secondaryBg,
//       tertiaryBg: item.tertiaryBg,
//       visible: item.visible,
//       generated: item.generated,
//       userId: item.userId,
//       cvThequeCritereId: newCvThequeCritere.id,
//     },
//   });

//   await Promise.all(
//     item.cvMinuteSections.map(async (section) => {
//       const newCvMinuteSection = await prisma.cvMinuteSection.create({
//         data: {
//           cvMinuteId: newCvMinute.id,
//           sectionId: section.sectionId,
//           sectionOrder: section.sectionOrder,
//           sectionTitle: section.sectionTitle,
//         },
//       });

//       await Promise.all(
//         section.sectionInfos.map(async (info) => {
//           await prisma.sectionInfo.create({
//             data: {
//               cvMinuteSectionId: newCvMinuteSection.id,
//               title: info.title,
//               content: info.content,
//               date: info.date,
//               company: info.company,
//               contrat: info.contrat,
//               icon: info.icon,
//               iconSize: info.iconSize,
//               order: info.order,
//             },
//           });
//         }),
//       );
//     }),
//   );
// }
