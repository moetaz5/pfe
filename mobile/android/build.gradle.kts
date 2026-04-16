allprojects {
    repositories {
        google()
        mavenCentral()
    }
    
    // Fix for "Illegal character in opaque part" / spaces in path on Windows
    if (System.getProperty("os.name").lowercase().contains("windows")) {
        val buildDirBase = File("C:/medica_build")
        if (!buildDirBase.exists()) {
            try {
                buildDirBase.mkdirs()
            } catch (e: Exception) {
                // Fallback if C:/ is not writable
            }
        }
        if (buildDirBase.exists() && buildDirBase.canWrite()) {
            layout.buildDirectory.set(File(buildDirBase, project.name))
        }
    }
}

subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(layout.buildDirectory)
}

