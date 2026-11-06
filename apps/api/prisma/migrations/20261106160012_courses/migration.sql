-- CreateTable
CREATE TABLE "Course" (
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "notice" TEXT,
    "order" INTEGER NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("slug")
);

-- SeedDefaultCourse
-- La ruta por defecto debe existir antes de la clave foránea: las etapas
-- existentes reciben `courseSlug` = 'fullstack-ia' y lo referencian.
INSERT INTO "Course" ("slug", "title", "objective", "notice", "order", "isPublished", "updatedAt")
VALUES ('fullstack-ia', 'Desarrollo de software con IA', 'Comprender, diseñar, construir, probar, desplegar y mantener software con inteligencia artificial, sin depender ciegamente de ella.', NULL, 0, true, CURRENT_TIMESTAMP);

-- AlterTable
ALTER TABLE "Stage" ADD COLUMN     "courseSlug" TEXT NOT NULL DEFAULT 'fullstack-ia';

-- CreateIndex
CREATE INDEX "Stage_courseSlug_idx" ON "Stage"("courseSlug");

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_courseSlug_fkey" FOREIGN KEY ("courseSlug") REFERENCES "Course"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
